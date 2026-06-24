import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { braveWebSearch, buildSearchQuery, LANGUAGE_INSTRUCTIONS } from './_lib';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getUserPlan(userId?: string): Promise<'free' | 'standard'> {
  if (!userId) return 'free';
  const { data } = await supabaseAdmin.from('profiles').select('plan').eq('id', userId).single();
  return (data?.plan as 'free' | 'standard') ?? 'free';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { transcript, articleText, freeText, url, language, wordCount, options, regenerateStyle, webSearch, userId } = req.body;

  // ── SERVER-SIDE PLAN ENFORCEMENT ─────────────────────────────────────────
  const plan = await getUserPlan(userId);
  const isStandard = plan === 'standard';
  const effectiveLanguage = isStandard ? (language ?? 'Français') : 'Français';
  const effectiveWebSearch = isStandard ? (webSearch ?? false) : false;
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
      res.json(JSON.parse(jsonMatch[0]));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la génération du script.' });
    }
    return;
  }
  // ────────────────────────────────────────────────────────────────────────

  let sourceBlock: string;
  if (articleText) {
    sourceBlock = `Here is the source article to analyze:\n\n---\n${articleText.substring(0, 10000)}\n---\n\nAnalyze the topic, structure, key arguments and tone of this article.`;
  } else if (transcript) {
    const isMetadata = transcript.startsWith('VIDEO TITLE:');
    sourceBlock = isMetadata
      ? `Here is the metadata of the source YouTube video:\n\n---\n${transcript.substring(0, 10000)}\n---\n\nBased on the title, description and keywords, deeply analyze the topic, target audience, key arguments and tone.`
      : `Here is the full transcript of the source YouTube video:\n\n---\n${transcript.substring(0, 10000)}\n---\n\nAnalyze the topic, structure, key arguments and tone of this transcript.`;
  } else {
    sourceBlock = `Source YouTube URL: ${url}\n\nAnalyze the probable topic of this video and create an original script on this subject.`;
  }

  let webSearchBlock = '';
  if (effectiveWebSearch && process.env.BRAVE_SEARCH_API_KEY) {
    try {
      const query = buildSearchQuery({ articleText, transcript, url });
      const searchResults = await braveWebSearch(query, process.env.BRAVE_SEARCH_API_KEY, effectiveLanguage);
      if (searchResults) webSearchBlock = `\n\nWEB SEARCH RESULTS (use to enrich with up-to-date facts — only what is relevant and credible):\n\n${searchResults}`;
    } catch (err) { console.warn('Web search skipped:', err); }
  }

  const userPrompt = `${sourceBlock}${webSearchBlock}

CRITICAL LANGUAGE REQUIREMENT: ${langInstruction}

Generate a highly engaging, original YouTube script that grabs viewers in the first 3 seconds and keeps them watching until the end.

TARGET LENGTH: ~${wordCount} words total (intro + all body sections + conclusion combined)
STYLE: ${regenerateStyle ? 'Explosive and ultra-dynamic — totally different angle from the source, surprising and provocative' : 'Authentic and conversational — like a trusted friend revealing a fascinating secret, not a corporate presentation'}
MODULES TO INCLUDE: ${optionsList}

MANDATORY WRITING RULES:
1. HOOK: Open with a jaw-dropping stat, provocative question, bold claim, or micro-story. NEVER "In this video..." or "Today I'm going to...".
2. OPEN LOOP: Tease the biggest payoff without revealing it.
3. AUTHENTIC VOICE: Write to ONE real person. "you", contractions, everyday vocabulary. Zero corporate tone.
4. RETENTION LOOPS every 60-90 seconds: Curiosity hooks before each section.
5. PATTERN INTERRUPTS: At least 2 surprising facts or counterintuitive twists.
6. CONCRETE EXAMPLES: Every abstract idea grounded in a specific example or mini-story.
7. DATA & CREDIBILITY: Use stats and quotes from the source verbatim.
8. EMOTIONAL ARC: Curiosity → understanding → hope.
9. CONCLUSION: Key insight in 1-2 powerful sentences.
10. CTA: Natural and logical, not a desperate plea.

FORMATTING RULE: ZERO markdown — no **bold**, no ## headers, no bullet points, no section labels. Pure flowing prose for voiceover.

CRITICAL: Every word in the JSON must be in ${effectiveLanguage}.

Respond ONLY with valid JSON:
{
  "titre": "catchy curiosity-driven title in ${effectiveLanguage} (max 70 chars)",
  "description": "Full YouTube SEO description in ${effectiveLanguage}: (1) 2-3 line hook, (2) 150-200 word body with keyword 2-3 times, (3) 3-5 hashtags. All in ${effectiveLanguage}.",
  "hook": "first 3-second hook in ${effectiveLanguage}",
  "script_complet": {
    "intro": "hook + open loop + credibility setup in ${effectiveLanguage} (~15% of word count)",
    "developpement": ["body section 1 with retention loop in ${effectiveLanguage}", "body section 2 with pattern interrupt in ${effectiveLanguage}", "body section 3 with emotional peak in ${effectiveLanguage}"],
    "conclusion": "key insight summary + emotional payoff in ${effectiveLanguage}",
    "cta": "natural call to action in ${effectiveLanguage}"
  },
  "idee_miniature": {
    "background": "#hexcolor",
    "text": "short punchy thumbnail text in ${effectiveLanguage} (max 5 words)",
    "elements": ["visual element 1", "visual element 2", "visual element 3"]
  }
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      system: `You are a world-class YouTube scriptwriter with 10+ years of experience crafting viral content. You master retention psychology, open loops, pattern interrupts, and emotional storytelling. Your scripts feel like conversations, not lectures. You always return valid JSON only, with no text before or after. ${langInstruction}`,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response');
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    res.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la génération du script.' });
  }
}
