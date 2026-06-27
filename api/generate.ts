import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { getUserPlan, getMonthlyUsageServer, incrementMonthlyUsageServer, saveHistoryServer, FREE_LIMIT, STANDARD_LIMIT, braveWebSearch, buildSearchQuery, LANGUAGE_INSTRUCTIONS } from '../lib/server.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { transcript, articleText, freeText, url, language, wordCount, options, regenerateStyle, webSearch, userId, sourceType: clientSourceType, sourceUrl: clientSourceUrl } = req.body;
  const serverSourceType: 'video' | 'article' | 'text' = freeText ? 'text' : articleText ? 'article' : 'video';

  // ── SERVER-SIDE PLAN + USAGE ENFORCEMENT ─────────────────────────────────
  const plan = await getUserPlan(userId);
  const isStandard = plan === 'standard';
  const effectiveLanguage = isStandard ? (language ?? 'Français') : 'Français';
  const effectiveWebSearch = isStandard ? (webSearch ?? false) : false;

  // Hard server-side usage limit check — cannot be bypassed by the client
  const limit = isStandard ? STANDARD_LIMIT : FREE_LIMIT;
  const currentUsage = await getMonthlyUsageServer(userId);
  if (currentUsage >= limit) {
    return res.status(429).json({
      error: isStandard
        ? `Limite de ${STANDARD_LIMIT} scripts/mois atteinte. Renouvelez votre abonnement.`
        : `Limite de ${FREE_LIMIT} scripts/mois atteinte. Passez au plan Standard pour continuer.`,
      limit_exceeded: true,
      plan,
    });
  }
  // ─────────────────────────────────────────────────────────────────────────

  const langInstruction = LANGUAGE_INSTRUCTIONS[effectiveLanguage] ?? `Write everything in ${effectiveLanguage}.`;
  const optionsList = Object.entries(options as Record<string, boolean>).filter(([, v]) => v).map(([k]) => k).join(', ');

  // ── FREE TEXT: dedicated strict rewrite prompt ───────────────────────────
  if (freeText) {
    const rewritePrompt = `You are given a text. Your ONLY job is to REWRITE it as a YouTube script in ${effectiveLanguage}.

══════════════════════════════════════════════
ORIGINAL TEXT (this is your ONLY source of content):
══════════════════════════════════════════════
${freeText.substring(0, 10000)}
══════════════════════════════════════════════

ABSOLUTE RULES — violation is not allowed:
1. Every fact, name, date, number, example, argument, and idea in your output MUST come directly from the text above.
2. Do NOT add, invent, or import any information that is not explicitly present in the original text.
3. Do NOT change the subject. Do NOT generalize to a broader topic.
4. You may ONLY change: the order of presentation, the vocabulary/phrasing, and the structure (to fit YouTube script format).
5. Target word count: ~${wordCount} words for the full script.
6. ${regenerateStyle ? "Make the delivery more explosive and dynamic — but still only using the original text's content." : "Make the delivery more conversational and engaging — but still only using the original text's content."}

YOUTUBE SCRIPT FORMAT RULES:
- Start with a strong hook (a striking sentence FROM the text content — not invented)
- Use an open loop right after the hook
- Write in a natural spoken voice — "you", contractions, conversational
- Add retention transitions between sections
- Conclusion: summarize the key point FROM the text
- CTA: natural invitation to subscribe / comment
- ZERO markdown, ZERO section labels, ZERO bold/headers — pure flowing prose

LANGUAGE: ${langInstruction}

Respond ONLY with valid JSON:
{
  "titre": "catchy title derived from the original text in ${effectiveLanguage} (max 70 chars)",
  "description": "Full YouTube SEO description in ${effectiveLanguage}: (1) 2-3 line hook, (2) 150-200 word summary, (3) 3-5 relevant hashtags. All in ${effectiveLanguage}.",
  "hook": "opening hook sentence in ${effectiveLanguage} — derived from the most striking point in the original text",
  "script_complet": {
    "intro": "hook + open loop based on the original text in ${effectiveLanguage} (~15% of word count)",
    "developpement": ["body section 1 in ${effectiveLanguage}", "body section 2 in ${effectiveLanguage}", "body section 3 in ${effectiveLanguage}"],
    "conclusion": "summary of key insight FROM the original text in ${effectiveLanguage}",
    "cta": "natural call to action in ${effectiveLanguage}"
  },
  "idee_miniature": {
    "background": "#hexcolor",
    "text": "short thumbnail text in ${effectiveLanguage} (max 5 words)",
    "elements": ["visual element 1", "visual element 2", "visual element 3"]
  }
}`;

    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8096,
        system: `You are a YouTube scriptwriter. You REWRITE provided texts into YouTube script format WITHOUT changing the content. You never invent facts. You always return valid JSON only. ${langInstruction}`,
        messages: [{ role: 'user', content: rewritePrompt }],
      });
      const content = message.content[0];
      if (content.type !== 'text') throw new Error('Unexpected response');
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      const parsed = JSON.parse(jsonMatch[0]);
      const [newUsage, historyItem] = await Promise.all([
        incrementMonthlyUsageServer(userId),
        saveHistoryServer(userId, {
          sourceType: serverSourceType,
          sourceUrl: clientSourceUrl ?? (serverSourceType === 'video' ? url : undefined),
          language: effectiveLanguage,
          wordCount: Number(wordCount) || 500,
          titre: parsed.titre ?? '',
          result: parsed,
        }),
      ]);
      res.json({ ...parsed, _newUsage: newUsage, _historyItem: historyItem });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la génération du script.' });
    }
    return;
  }
  // ────────────────────────────────────────────────────────────────────────

  // ── BUILD SOURCE BLOCK ──────────────────────────────────────────────────────
  let sourceBlock: string;
  let sourceType: 'full_transcript' | 'metadata_only' | 'article' | 'url_only';

  if (articleText) {
    sourceType = 'article';
    sourceBlock = `════════════════════════════════════════
SOURCE ARTICLE (your ONLY content base):
════════════════════════════════════════
${articleText.substring(0, 12000)}
════════════════════════════════════════`;
  } else if (transcript) {
    const isMetadata = transcript.startsWith('VIDEO TITLE:');
    sourceType = isMetadata ? 'metadata_only' : 'full_transcript';
    sourceBlock = `════════════════════════════════════════
${isMetadata ? 'SOURCE VIDEO METADATA' : 'SOURCE VIDEO — FULL TRANSCRIPT'} (your ONLY content base):
════════════════════════════════════════
${transcript.substring(0, 12000)}
════════════════════════════════════════`;
  } else {
    sourceType = 'url_only';
    sourceBlock = `════════════════════════════════════════
SOURCE VIDEO URL: ${url}
════════════════════════════════════════
No transcript available. Use the URL topic only.`;
  }

  // ── WEB SEARCH ENRICHMENT ────────────────────────────────────────────────
  let webSearchBlock = '';
  if (effectiveWebSearch && process.env.BRAVE_SEARCH_API_KEY) {
    try {
      const query = buildSearchQuery({ articleText, transcript, url });
      const searchResults = await braveWebSearch(query, process.env.BRAVE_SEARCH_API_KEY, effectiveLanguage);
      if (searchResults) {
        webSearchBlock = `

════════════════════════════════════════
WEB SEARCH RESULTS — use ONLY to add missing stats, dates, or facts that complement the source. Never use to change the subject.
════════════════════════════════════════
${searchResults}
════════════════════════════════════════`;
      }
    } catch (err) { console.warn('Web search skipped:', err); }
  }

  // ── CORE INSTRUCTION depending on source quality ─────────────────────────
  const coreInstruction = sourceType === 'full_transcript'
    ? `Your mission: REWRITE AND IMPROVE this video's transcript as a viral YouTube script.
ABSOLUTE RULES:
— Every argument, fact, example, stat, anecdote, and insight MUST come from the transcript above. Do NOT invent.
— Keep the EXACT same subject, depth, and point of view as the original video.
— You may ONLY change: structure, delivery style, hooks, transitions, and word choice to make it more engaging.
— If web results are provided, use them ONLY to add specific missing stats or dates that strengthen existing points — never to shift the topic.`
    : sourceType === 'metadata_only'
    ? `Your mission: Write a YouTube script strictly about the topic described in the video metadata above.
ABSOLUTE RULES:
— The subject is FIXED by the title and description. Stay 100% on this exact topic.
— Match the depth, angle, and specificity of the original video as described.
— If web results are provided, use them to add concrete facts that match the described topic.
— Do NOT generalize or drift to adjacent topics.`
    : sourceType === 'article'
    ? `Your mission: REWRITE this article as a viral YouTube script.
ABSOLUTE RULES:
— Every fact, argument, and example MUST come from the article above. Do NOT invent.
— Keep the exact same subject and conclusions as the source article.
— Use web results only to add missing supporting stats, not to change the subject.`
    : `Your mission: Write a script about the topic of this YouTube video.
Stay as close as possible to what the URL suggests about the subject.`;

  const userPrompt = `${sourceBlock}${webSearchBlock}

${coreInstruction}

LANGUAGE: ${langInstruction}
TARGET LENGTH: ~${wordCount} words total (intro + all body sections + conclusion)
STYLE: ${regenerateStyle ? 'More explosive and dynamic than the original — different angle, same content' : 'Conversational and authentic — like a trusted friend explaining something fascinating'}

YOUTUBE SCRIPT RULES (apply on top of the source content):
1. HOOK: Open with the most shocking or intriguing point FROM the source. Never "In this video..." or "Today...".
2. OPEN LOOP immediately after the hook: tease the biggest revelation without giving it away.
3. VOICE: Write to ONE person. Use "you", contractions, everyday language. Zero corporate tone.
4. RETENTION: Add a curiosity hook before each new section.
5. SPECIFICITY: Every claim must have a concrete example or number FROM the source (or web results if provided).
6. EMOTIONAL ARC: Curiosity → understanding → actionable insight.
7. CONCLUSION: Summarize the single most important point from the source in 1-2 powerful sentences.
8. CTA: Natural invitation to subscribe or comment — tied to the video's specific topic.
9. ZERO markdown: no **bold**, no ## headers, no bullet points. Pure flowing spoken prose.

CRITICAL: Every single word of the JSON output must be in ${effectiveLanguage}.

Respond ONLY with valid JSON — no text before or after:
{
  "titre": "curiosity-driven title in ${effectiveLanguage} that matches the source topic exactly (max 70 chars)",
  "description": "Full YouTube SEO description in ${effectiveLanguage}: hook (2-3 lines) + summary (150-200 words, keyword 2-3×) + hashtags. All about the source topic.",
  "hook": "opening hook sentence in ${effectiveLanguage} — the most striking point FROM the source",
  "script_complet": {
    "intro": "hook + open loop based strictly on the source content (~15% of word count) in ${effectiveLanguage}",
    "developpement": [
      "body section 1 — key point FROM the source with concrete example, in ${effectiveLanguage}",
      "body section 2 — key point FROM the source with retention hook, in ${effectiveLanguage}",
      "body section 3 — key point FROM the source with emotional peak, in ${effectiveLanguage}"
    ],
    "conclusion": "summary of the main insight FROM the source + emotional payoff, in ${effectiveLanguage}",
    "cta": "natural call to action tied to this specific topic, in ${effectiveLanguage}"
  },
  "idee_miniature": {
    "background": "#hexcolor",
    "text": "thumbnail text in ${effectiveLanguage} (max 5 words, matches the source topic)",
    "elements": ["visual element 1", "visual element 2", "visual element 3"]
  }
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      system: `You are an expert YouTube scriptwriter. Your specialty is taking existing video transcripts or articles and rewriting them into viral YouTube scripts — keeping ALL the original content, facts, and insights, while dramatically improving the structure, hooks, and delivery. You NEVER invent facts or change the subject. You always return valid JSON only, with no text before or after. ${langInstruction}`,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response');
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    const parsed = JSON.parse(jsonMatch[0]);
    const [newUsage, historyItem] = await Promise.all([
      incrementMonthlyUsageServer(userId),
      saveHistoryServer(userId, {
        sourceType: serverSourceType,
        sourceUrl: clientSourceUrl ?? (serverSourceType === 'video' ? url : serverSourceType === 'article' ? url : undefined),
        language: effectiveLanguage,
        wordCount: Number(wordCount) || 500,
        titre: parsed.titre ?? '',
        result: parsed,
      }),
    ]);
    res.json({ ...parsed, _newUsage: newUsage, _historyItem: historyItem });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la génération du script.' });
  }
}
