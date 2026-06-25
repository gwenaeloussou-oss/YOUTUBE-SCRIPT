import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { getUserPlan } from '../lib/server.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { titre, hook, description, script_complet, language, userId } = req.body;

  // ── SERVER-SIDE PLAN ENFORCEMENT ─────────────────────────────────────────
  if (!userId) return res.status(401).json({ error: 'Non autorisé.' });
  const plan = await getUserPlan(userId);
  if (plan !== 'standard') {
    return res.status(403).json({ error: 'Disponible uniquement avec l\'abonnement Standard.' });
  }
  // ─────────────────────────────────────────────────────────────────────────

  const fullScript = [
    script_complet?.intro ?? '',
    ...(script_complet?.developpement ?? []),
    script_complet?.conclusion ?? '',
    script_complet?.cta ?? '',
  ].filter(Boolean).join('\n\n');

  const bannerOptions: Record<string, string> = {
    'Français': 'BREAKING / EXCLUSIF / RÉVÉLATION / ALERTE / CHOC',
    'English': 'BREAKING NEWS / EXCLUSIVE / REVEALED / ALERT / SHOCKING',
    'Español': 'ÚLTIMA HORA / EXCLUSIVO / URGENTE / REVELADO / IMPACTO',
    'Português': 'URGENTE / EXCLUSIVO / REVELADO / ÚLTIMA HORA / IMPACTO',
  };
  const bannerHint = bannerOptions[language] ?? `BREAKING / EXCLUSIVE (adapt to ${language})`;

  const langLabel = language; // e.g. "Français", "English", "Español"

  const prompt = `Analyze this YouTube video script and generate a complete structured JSON thumbnail prompt.

VIDEO LANGUAGE: ${langLabel}
TITLE: ${titre}
HOOK: ${hook}
DESCRIPTION: ${description ?? ''}
FULL SCRIPT:
${fullScript.substring(0, 6000)}

══════════════════════════════════════════════════════
LANGUAGE RULE — MANDATORY:
Every single text value in the JSON MUST be written in ${langLabel}.
The ONLY exception is "prompt_image_final" which MUST be in English.
Do NOT use English words anywhere else. Translate everything to ${langLabel}.
══════════════════════════════════════════════════════

Instructions:
1. Deeply analyze the script: extract main subjects/characters, dominant country or location, emotional tone, narrative tension, core message.
2. Generate a thumbnail concept that maximizes click-through rate — dramatic, emotional, impossible to ignore.
3. Available banner options for ${langLabel}: ${bannerHint}

Return ONLY this JSON (no markdown, no code block, no explanation):

{
  "langue_miniature": "${langLabel} — ⚠️ TOUS les textes visibles sur la miniature doivent être rédigés en ${langLabel}. Bannière, titre, overlays : tout en ${langLabel}.",
  "banner": "[label d'urgence le plus percutant EN ${langLabel} — ex: CHOC / RÉVÉLATION / EXCLUSIF]",
  "banner_style": "[description du style de bannière EN ${langLabel}]",
  "titre_miniature": {
    "ligne_1": "[MOT CHOC EN MAJUSCULES, 2-3 mots max, EN ${langLabel}]",
    "ligne_2": "[complément court, 3-4 mots EN ${langLabel}]",
    "style": "[description du style typographique EN ${langLabel}]"
  },
  "personnages": [
    {
      "qui": "[nom ou description visuelle du sujet principal EN ${langLabel}]",
      "position": "[gauche | centre | droite — EN ${langLabel}]",
      "expression": "[émotion exacte EN ${langLabel}: choqué / triomphant / furieux / déterminé / trahi / terrifié]",
      "taille": "[dominant | secondaire — EN ${langLabel}]",
      "pose": "[face caméra | profil vers le centre | buste | corps entier — EN ${langLabel}]"
    }
  ],
  "background": {
    "ambiance": "[ambiance EN ${langLabel}: apocalyptique | dramatique | triomphant | révélateur | urgent | explosif]",
    "couleurs": "[palette de couleurs dominantes EN ${langLabel}]",
    "elements": ["[élément visuel 1 EN ${langLabel}]", "[élément visuel 2 EN ${langLabel}]", "[élément visuel 3 EN ${langLabel}]"],
    "ciel": "[atmosphère ou ciel dramatique EN ${langLabel}]"
  },
  "elements_graphiques": {
    "fleches": true,
    "couleur_fleche": "[jaune | vert | rouge | blanc — EN ${langLabel}]",
    "documents_props": ["[accessoire physique pertinent EN ${langLabel}]"],
    "icones": ["[emoji pertinent]"],
    "overlays": ["[texte overlay dramatique EN ${langLabel} — max 2 mots]"]
  },
  "composition": {
    "profondeur": "[description de la profondeur de champ EN ${langLabel}]",
    "contraste": "[description du contraste EN ${langLabel}]",
    "ratio": "16:9 YouTube (1280x720)",
    "style_global": "[style visuel global EN ${langLabel}]"
  },
  "prompt_image_final": "[150-200 word image generation prompt IN ENGLISH ONLY for Midjourney/DALL-E/Flux. Describe: main subject with exact expression and pose, background atmosphere with specific colors and elements, lighting setup, composition, emotional impact, visual style. Self-contained. IMPORTANT FOR THE EDITOR: all visible text on the final thumbnail (banner, title, overlays) must be written in ${langLabel} — not in English. No text or letters inside the generated image itself.]"
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: `You are a world-class YouTube thumbnail art director and viral content strategist. You analyze video scripts deeply and generate ultra-precise JSON prompts for creating viral thumbnails. You always return ONLY valid JSON — no text before or after, no markdown code blocks. CRITICAL: All text fields in the JSON must be written in ${language}, except "prompt_image_final" which must always be in English.`,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response');

    // Robust JSON extraction: find outermost { }
    const text = content.text.trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) throw new Error('No JSON found in response');
    const jsonStr = text.slice(start, end + 1);
    res.json(JSON.parse(jsonStr));
  } catch (err) {
    console.error('generate-thumb-prompt error:', err);
    res.status(500).json({ error: 'Erreur lors de la génération du prompt JSON.' });
  }
}
