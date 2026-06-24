import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { titre, hook, description, script_complet, language, userId } = req.body;

  // ── SERVER-SIDE PLAN ENFORCEMENT ─────────────────────────────────────────
  if (!userId) return res.status(401).json({ error: 'Non autorisé.' });
  const { data: profile } = await supabaseAdmin.from('profiles').select('plan').eq('id', userId).single();
  if (!profile || profile.plan !== 'standard') {
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

  const prompt = `Analyze this YouTube video script and generate a complete structured JSON thumbnail prompt.

VIDEO LANGUAGE: ${language}
TITLE: ${titre}
HOOK: ${hook}
DESCRIPTION: ${description ?? ''}
FULL SCRIPT:
${fullScript.substring(0, 6000)}

Instructions:
1. Deeply analyze the script: extract main subjects/characters, dominant country or location, emotional tone, narrative tension, core message.
2. Generate a thumbnail concept that maximizes click-through rate — dramatic, emotional, impossible to ignore.
3. Adapt ALL text fields (banner, titre_miniature, overlays) to the language "${language}", EXCEPT "prompt_image_final" which MUST always be written in English.
4. Available banner options for ${language}: ${bannerHint}

Return ONLY this JSON (no markdown, no code block, no explanation):

{
  "banner": "[most impactful urgency label in ${language}]",
  "banner_style": "bright red background, bold white text, rounded corners, top centered",
  "titre_miniature": {
    "ligne_1": "[SHOCK KEYWORD in CAPS, 2-3 words max, in ${language}]",
    "ligne_2": "[short complement, 3-4 words in ${language}]",
    "style": "neon yellow for ligne_1, white with black outline for ligne_2, ultra-bold Impact or Anton font"
  },
  "personnages": [
    {
      "qui": "[name or visual description of the main subject]",
      "position": "left | center | right",
      "expression": "[exact emotion: shocked / triumphant / furious / determined / betrayed / terrified]",
      "taille": "dominant | secondary",
      "pose": "facing camera | profile looking toward center | bust shot | full body"
    }
  ],
  "background": {
    "ambiance": "[apocalyptic | dramatic | triumphant | revelatory | urgent | explosive]",
    "couleurs": "[dominant color palette]",
    "elements": ["[specific visual element 1]", "[specific visual element 2]", "[specific visual element 3]"],
    "ciel": "[dramatic sky or atmosphere]"
  },
  "elements_graphiques": {
    "fleches": true,
    "couleur_fleche": "yellow | green | red | white",
    "documents_props": ["[relevant physical prop]"],
    "icones": ["[relevant emoji]"],
    "overlays": ["[dramatic text overlay in ${language} — max 2 words]"]
  },
  "composition": {
    "profondeur": "main subject in sharp foreground, dramatic blurred background",
    "contraste": "very high contrast, maximum color saturation",
    "ratio": "16:9 YouTube standard (1280x720)",
    "style_global": "hyperrealistic 3D or cinematic photo, dramatic orange/red rim lighting, studio quality"
  },
  "prompt_image_final": "[150-200 word image generation prompt IN ENGLISH ONLY for Midjourney/DALL-E/Flux. Describe: main subject with exact expression and pose, background atmosphere with specific colors and elements, lighting setup, composition, emotional impact, visual style. Self-contained. No text or letters in the generated image.]"
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: 'You are a world-class YouTube thumbnail art director and viral content strategist. You analyze video scripts deeply and generate ultra-precise JSON prompts for creating viral thumbnails. You always return ONLY valid JSON — no text before or after, no markdown code blocks.',
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
