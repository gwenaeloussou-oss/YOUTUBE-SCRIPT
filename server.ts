import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

// Scrape YouTube page for title + description as fallback
async function fetchYouTubeMetadata(videoId: string): Promise<string> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'fr,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error('Cannot fetch YouTube page');
  const html = await res.text();

  const titleMatch = html.match(/<meta property="og:title" content="([^"]*)"/) ?? html.match(/<title>([^<]*)<\/title>/);
  const descMatch = html.match(/<meta property="og:description" content="([^"]*)"/) ?? html.match(/<meta name="description" content="([^"]*)"/);
  const longDescMatch = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
  const keywordsMatch = html.match(/<meta name="keywords" content="([^"]*)"/);

  const title = titleMatch?.[1]?.replace(/ - YouTube$/, '').trim() ?? '';
  const longDesc = longDescMatch?.[1]?.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').substring(0, 3000) ?? '';
  const shortDesc = descMatch?.[1] ?? '';
  const description = longDesc || shortDesc;
  const keywords = keywordsMatch?.[1] ?? '';

  if (!title) throw new Error('Metadata not found');

  return `VIDEO TITLE: ${title}\n\nDESCRIPTION: ${description}${keywords ? `\n\nKEYWORDS: ${keywords}` : ''}`;
}

// Fetch YouTube transcript via InnerTube API
async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  const CLIENT_VERSION = '20.10.38';

  // Try InnerTube API first
  const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': `com.google.android.youtube/${CLIENT_VERSION} (Linux; U; Android 14)`,
    },
    body: JSON.stringify({
      context: { client: { clientName: 'ANDROID', clientVersion: CLIENT_VERSION } },
      videoId,
    }),
  });

  if (!playerRes.ok) throw new Error('Player API failed');

  const playerData = await playerRes.json() as any;
  const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!Array.isArray(tracks) || tracks.length === 0) {
    // No captions — fall back to page metadata
    return fetchYouTubeMetadata(videoId);
  }

  const captionUrl = tracks[0].baseUrl;
  const captionRes = await fetch(captionUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  if (!captionRes.ok) throw new Error('Caption fetch failed');
  const xml = await captionRes.text();

  // Parse XML — try both formats
  const segments: string[] = [];
  const textRegex = /<text[^>]*>([^<]*)<\/text>/g;
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;

  let match: RegExpExecArray | null;
  while ((match = textRegex.exec(xml)) !== null) {
    const decoded = match[1]
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n/g, ' ').trim();
    if (decoded) segments.push(decoded);
  }

  if (segments.length === 0) {
    while ((match = pRegex.exec(xml)) !== null) {
      const text = match[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
      if (text) segments.push(text);
    }
  }

  const transcript = segments.join(' ').replace(/\s+/g, ' ').trim();
  // If transcript ended up empty, try metadata
  return transcript || fetchYouTubeMetadata(videoId);
}

// Get YouTube transcript
app.get('/api/transcript', async (req, res) => {
  const { url } = req.query as { url: string };
  const videoId = extractVideoId(url);
  if (!videoId) {
    res.status(400).json({ error: 'URL YouTube invalide' });
    return;
  }
  try {
    const transcript = await fetchYouTubeTranscript(videoId);
    res.json({ transcript, videoId });
  } catch (err) {
    res.status(404).json({ error: 'Transcription non disponible pour cette vidéo.' });
  }
});

// Fetch and extract text from an article URL
app.get('/api/article', async (req, res) => {
  const { url } = req.query as { url: string };
  if (!url?.startsWith('http')) {
    res.status(400).json({ error: 'URL invalide.' });
    return;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr,en;q=0.9',
      },
    });

    if (!response.ok) {
      res.status(400).json({ error: `Impossible d'accéder à l'article (${response.status}).` });
      return;
    }

    const html = await response.text();

    // Remove scripts, styles, nav, footer, ads
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // Extract text from article/main/p tags
    const paragraphs: string[] = [];

    const articleMatch = cleaned.match(/<article[\s\S]*?<\/article>/i);
    const mainMatch = cleaned.match(/<main[\s\S]*?<\/main>/i);
    const source = articleMatch?.[0] ?? mainMatch?.[0] ?? cleaned;

    const pRegex = /<(?:p|h1|h2|h3|h4|blockquote|li)[^>]*>([\s\S]*?)<\/(?:p|h1|h2|h3|h4|blockquote|li)>/gi;
    let match: RegExpExecArray | null;
    while ((match = pRegex.exec(source)) !== null) {
      const text = match[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ').trim();
      if (text.length > 30) paragraphs.push(text);
    }

    if (paragraphs.length === 0) {
      res.status(404).json({ error: "Impossible d'extraire le contenu de cet article. Le site est peut-être protégé." });
      return;
    }

    const text = paragraphs.join('\n\n');
    res.json({ text, wordCount: text.split(/\s+/).length });
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération de l'article." });
  }
});

// Brave Search — returns top web results as enriched context
async function braveWebSearch(query: string, apiKey: string, lang: string): Promise<string> {
  const searchLang = { 'Français': 'fr', 'English': 'en', 'Español': 'es', 'Português': 'pt' }[lang] ?? 'fr';
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=6&search_lang=${searchLang}&safesearch=moderate`,
    { headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey } }
  );
  if (!res.ok) throw new Error(`Brave Search error ${res.status}`);
  const data = await res.json() as any;
  const results: any[] = data.web?.results ?? [];
  if (results.length === 0) return '';
  return results
    .map((r: any, i: number) => `[${i + 1}] ${r.title}\n${r.description ?? ''}\n(${r.url})`)
    .join('\n\n');
}

// Build a concise search query from available source content
function buildSearchQuery(source: { freeText?: string; articleText?: string; transcript?: string; url?: string }): string {
  if (source.transcript?.startsWith('VIDEO TITLE:')) {
    const m = source.transcript.match(/VIDEO TITLE:\s*(.+)/);
    return m?.[1]?.trim() ?? source.transcript.substring(0, 120);
  }
  const raw = source.freeText ?? source.articleText ?? source.transcript ?? source.url ?? '';
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 150);
}

// Language code map for explicit output language instruction
const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  'Français':   'Write everything in French (fr). Every single word of the script, title, description, hook and CTA must be in French.',
  'English':    'Write everything in English (en). Every single word of the script, title, description, hook and CTA must be in English.',
  'Español':    'Write everything in Spanish (es). Every single word of the script, title, description, hook and CTA must be in Spanish.',
  'Português':  'Write everything in Portuguese (pt). Every single word of the script, title, description, hook and CTA must be in Portuguese.',
};

// Generate script with Claude
app.post('/api/generate', async (req, res) => {
  const { transcript, articleText, freeText, url, language, wordCount, options, regenerateStyle, webSearch } = req.body;

  const langInstruction = LANGUAGE_INSTRUCTIONS[language] ?? `Write everything in ${language}.`;

  const optionsList = Object.entries(options as Record<string, boolean>)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', ');

  // ── FREE TEXT: dedicated strict rewrite prompt ──────────────────────────
  if (freeText) {
    const rewritePrompt = `You are given a text. Your ONLY job is to REWRITE it as a YouTube script in ${language}.

══════════════════════════════════════════════
ORIGINAL TEXT (this is your ONLY source of content):
══════════════════════════════════════════════
${freeText.substring(0, 10000)}
══════════════════════════════════════════════

ABSOLUTE RULES — violation is not allowed:
1. Every fact, name, date, number, example, argument, and idea in your output MUST come directly from the text above.
2. Do NOT add, invent, or import any information that is not explicitly present in the original text.
3. Do NOT change the subject. Do NOT generalize to a broader topic. The subject of your output = the subject of the original text.
4. You may ONLY change: the order of presentation, the vocabulary/phrasing, and the structure (to fit YouTube script format).
5. Target word count: ~${wordCount} words for the full script.
6. ${regenerateStyle ? 'Make the delivery more explosive and dynamic — but still only using the original text\'s content.' : 'Make the delivery more conversational and engaging — but still only using the original text\'s content.'}

YOUTUBE SCRIPT FORMAT RULES:
- Start with a strong hook (a striking sentence FROM the text content — not invented)
- Use an open loop right after the hook (tease the main revelation from the text)
- Write in a natural spoken voice — "you", contractions, conversational
- Add retention transitions between sections ("Et voilà ce que la plupart des gens ignorent...")
- Conclusion: summarize the key point FROM the text
- CTA: natural invitation to subscribe / comment
- ZERO markdown, ZERO section labels, ZERO bold/headers — pure flowing prose for voiceover

LANGUAGE: ${langInstruction}

Respond ONLY with valid JSON, no text before or after:
{
  "titre": "catchy title derived from the original text in ${language} (max 70 chars)",
  "description": "Full YouTube SEO description in ${language}: (1) 2-3 line hook, (2) 150-200 word summary of what the viewer learns (only from the source text), (3) 3-5 relevant hashtags. All in ${language}.",
  "hook": "opening hook sentence in ${language} — derived from the most striking point in the original text",
  "script_complet": {
    "intro": "hook + open loop based on the original text in ${language} (~15% of word count)",
    "developpement": ["body section 1 — content from original text, in ${language}", "body section 2 — content from original text, in ${language}", "body section 3 — content from original text, in ${language}"],
    "conclusion": "summary of key insight FROM the original text in ${language}",
    "cta": "natural call to action in ${language}"
  },
  "idee_miniature": {
    "background": "#hexcolor",
    "text": "short thumbnail text in ${language} (max 5 words, derived from the text topic)",
    "elements": ["visual element 1 related to text topic", "visual element 2", "visual element 3"]
  }
}`;

    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8096,
        system: `You are a YouTube scriptwriter. You REWRITE provided texts into YouTube script format WITHOUT changing the content. You never invent facts. You only transform style and structure. You always return valid JSON only. ${langInstruction}`,
        messages: [{ role: 'user', content: rewritePrompt }],
      });

      const content = message.content[0];
      if (content.type !== 'text') throw new Error('Unexpected response');
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
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
      ? `Here is the metadata of the source YouTube video (no captions available):\n\n---\n${transcript.substring(0, 10000)}\n---\n\nBased on the title, description and keywords, deeply analyze the topic, target audience, key arguments and tone to create an original script.`
      : `Here is the full transcript of the source YouTube video:\n\n---\n${transcript.substring(0, 10000)}\n---\n\nAnalyze the topic, structure, key arguments and tone of this transcript.`;
  } else {
    sourceBlock = `Source YouTube URL: ${url}\n\nAnalyze the probable topic of this video and create an original script on this subject.`;
  }

  // Web search enrichment (optional, requires BRAVE_SEARCH_API_KEY)
  let webSearchBlock = '';
  if (webSearch && process.env.BRAVE_SEARCH_API_KEY) {
    try {
      const query = buildSearchQuery({ articleText, transcript, url });
      const searchResults = await braveWebSearch(query, process.env.BRAVE_SEARCH_API_KEY, language);
      if (searchResults) {
        webSearchBlock = `\n\nWEB SEARCH RESULTS (use these to enrich the script with up-to-date facts, statistics and context — only use what is relevant and credible):\n\n${searchResults}`;
      }
    } catch (err) {
      console.warn('Web search skipped:', err);
    }
  }

  const userPrompt = `${sourceBlock}${webSearchBlock}

CRITICAL LANGUAGE REQUIREMENT: ${langInstruction}

Generate a highly engaging, original YouTube script that grabs viewers in the first 3 seconds and keeps them watching until the end.

TARGET LENGTH: ~${wordCount} words total (intro + all body sections + conclusion combined)
STYLE: ${regenerateStyle ? 'Explosive and ultra-dynamic — totally different angle from the source, surprising and provocative' : 'Authentic and conversational — like a trusted friend revealing a fascinating secret, not a corporate presentation'}
MODULES TO INCLUDE: ${optionsList}

MANDATORY WRITING RULES — apply every single one:

1. HOOK (first 3 seconds): Open with ONE of these proven formulas:
   - A jaw-dropping stat or counterintuitive fact ("90% of people have no idea that...")
   - A provocative question that triggers immediate self-reflection
   - A bold, controversial claim that demands attention
   - A micro-story that drops the viewer into the middle of the action
   NEVER start with "In this video..." or "Today I'm going to show you..." — those kill retention instantly.

2. OPEN LOOP: After the hook, tease the biggest payoff of the video WITHOUT revealing it ("By the end of this video, you'll understand why most people fail at X — and exactly how to avoid it").

3. AUTHENTIC VOICE: Write as if speaking directly to ONE real person. Use "you", natural contractions, everyday vocabulary. Zero corporate tone. The viewer must feel spoken to, not lectured at.

4. RETENTION LOOPS every 60-90 seconds: Plant a curiosity hook before each new section ("But here's where it gets really interesting...", "And this next part? Nobody talks about it..."). Make them feel they can't stop watching.

5. PATTERN INTERRUPTS: At least 2 times in the body, break the expected flow — a surprising fact, a counterintuitive twist, a direct challenge to common belief.

6. CONCRETE EXAMPLES & STORIES: Every abstract idea must be grounded in a specific example, analogy, or mini-story. Abstractions don't create emotions — stories do.

7. DATA & CREDIBILITY: If the source contains stats, studies, or expert quotes — use them verbatim and credit them. They are gold. If not available, use plausible, well-known reference points from the domain.

8. EMOTIONAL ARC: The script must take the viewer on a journey — from curiosity/pain to understanding/hope. End sections on an emotionally satisfying note before opening the next loop.

9. CONCLUSION: Summarize the key insight in 1-2 powerful sentences. Make the viewer feel they gained something real.

10. CTA: Natural and logical — not a desperate plea. Frame it as the obvious next step for someone who cares about this topic.

FORMATTING RULE (absolute): The script text must contain ZERO markdown formatting — no **bold**, no ## headers, no bullet points, no section labels like "PARTIE 1 :" or "INTRODUCTION :". Write pure flowing prose only, as if it is a voiceover that will be read aloud. Never prefix a section with its title inside the text.

CRITICAL: Every word in the JSON must be in ${language}.

Respond ONLY with a valid JSON object, no text before or after:
{
  "titre": "catchy, curiosity-driven title in ${language} (max 70 chars)",
  "description": "Full YouTube SEO description in ${language} structured as follows: (1) First 2-3 lines: powerful hook that summarizes the video value proposition — these lines appear in search results before the 'Show more', make them count. (2) Main body 150-200 words: what the viewer will learn, key points covered, why this video matters NOW. Use the main keyword naturally 2-3 times. (3) A short block of 3-5 relevant hashtags on their own line (e.g. #YouTube #Football #Mondial2026). (4) Optional: 1-line call to subscribe. Write everything in ${language}.",
  "hook": "first 3-second hook in ${language} — use one of the proven formulas above",
  "script_complet": {
    "intro": "hook + open loop + credibility setup in ${language} (~15% of word count)",
    "developpement": ["body section 1 with retention loop at end in ${language}", "body section 2 with pattern interrupt in ${language}", "body section 3 with emotional peak in ${language}"],
    "conclusion": "key insight summary + emotional payoff in ${language}",
    "cta": "natural call to action in ${language}"
  },
  "idee_miniature": {
    "background": "#hexcolor",
    "text": "short punchy thumbnail text in ${language} (max 5 words)",
    "elements": ["visual element 1", "visual element 2", "visual element 3"]
  }
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      system: `You are a world-class YouTube scriptwriter with 10+ years of experience crafting viral content with tens of millions of cumulative views. You master retention psychology, open loops, pattern interrupts, and emotional storytelling. Your scripts feel like conversations, not lectures — they hook immediately, sustain curiosity, and deliver real value. You always return valid JSON only, with no text before or after. ${langInstruction}`,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response');

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    res.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la génération du script.' });
  }
});

// Generate thumbnail with Claude (prompt) + Imagen 4 (image)
app.post('/api/generate-thumbnail', async (req, res) => {
  const { titre, hook, description, idee_miniature, script_complet } = req.body;

  const scriptSummary = script_complet
    ? `INTRO: ${script_complet.intro ?? ''}\n\nDÉVELOPPEMENT: ${(script_complet.developpement ?? []).join('\n')}\n\nCONCLUSION: ${script_complet.conclusion ?? ''}\n\nCTA: ${script_complet.cta ?? ''}`
    : '';

  try {
    // Step 1: Claude analyzes the full script and crafts the ideal image prompt
    const promptMsg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 900,
      system: 'You are a world-class YouTube thumbnail art director. You deeply analyze video scripts and craft ultra-precise image generation prompts in English only. Return ONLY the image generation prompt — no explanation, no title, no preamble.',
      messages: [{
        role: 'user',
        content: `You are creating a YouTube thumbnail for this video. Study every detail of the script to capture its true depth and emotion.

SCRIPT TITLE: ${titre}
HOOK: ${hook}
DESCRIPTION: ${description ?? ''}
VISUAL CONCEPT: ${idee_miniature.text}
KEY ELEMENTS: ${idee_miniature.elements.join(', ')}
DOMINANT COLOR: ${idee_miniature.background}
FULL SCRIPT:
${scriptSummary.substring(0, 5000)}

Generate a single ultra-detailed image generation prompt that describes EXACTLY this composition:

MANDATORY COMPOSITION — describe each element with maximum precision:

1. CHANNEL AVATAR (left or center-left, ~40% of frame width):
   A stylized 3D animated avatar character — the channel host — with a strong, expressive face showing an emotion that perfectly matches the video's core message (shock, disbelief, excitement, urgency, or curiosity — choose based on script tone). The avatar has a highly detailed face: expressive eyes wide open or narrowed, mouth open in reaction, eyebrows raised dramatically. The character wears modern casual clothes fitting the topic. Rendered in vibrant 3D animation style, like a high-quality YouTube character avatar.

2. SCREEN / MONITOR (right side, ~50% of frame, slightly behind or beside the avatar):
   A sleek modern widescreen monitor or TV screen tilted at a slight angle for depth. On the screen: a vivid, cinematic scene that visually represents the VIDEO'S CORE SUBJECT derived from the script — describe what specific scene, image, statistic, moment, or visual metaphor from the video content should appear on that screen. The screen glows with intense light, casting a colored reflection on the avatar's face. The screen content must directly reflect the DEPTH of the video topic.

3. BACKGROUND:
   A dramatic gradient background derived from ${idee_miniature.background}, with volumetric light rays, subtle depth-of-field bokeh, and a slight vignette. The atmosphere matches the video's emotional tone — tense, exciting, revelatory, or urgent.

4. LIGHTING & DEPTH:
   Cinematic three-point lighting. Strong rim light on the avatar from behind. The screen illuminates the scene from the right. Deep shadows create contrast. Everything is razor-sharp in the foreground, slightly blurred depth in the background.

5. COMPOSITION:
   16:9 ratio. Rule of thirds. The avatar's face is at the top-left third intersection — the most eye-catching position. The screen fills the right portion. Maximum visual tension between the two elements. Zero dead space. No text anywhere in the image.

6. PSYCHOLOGICAL CLICK-TRIGGER:
   The overall image must create an irresistible curiosity gap — the viewer must feel they NEED to click to understand what is happening. Describe the exact emotional reaction the thumbnail should provoke based on the script's hook: "${hook}".

Write one single cohesive paragraph in English that describes this entire scene with extreme visual detail, as if directing a 3D render artist. Include colors, textures, lighting angles, character expression details, and screen content.`,
      }],
    });

    const claudePrompt = promptMsg.content[0].type === 'text' ? promptMsg.content[0].text.trim() : '';
    const imagePrompt = `${claudePrompt}, professional YouTube thumbnail, 16:9 aspect ratio, ultra high contrast, cinematic lighting, 4K render quality, vibrant saturated colors, sharp foreground, no text, no watermark, no UI elements`;

    // Step 2: Imagen 4 generates the image
    const imageRes = await gemini.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: imagePrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '16:9',
        outputMimeType: 'image/jpeg',
      },
    });

    const imageBytes = imageRes.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) throw new Error('No image returned from Gemini');

    res.json({ image: `data:image/jpeg;base64,${imageBytes}` });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message ?? 'Erreur de génération de miniature.' });
  }
});

// Generate structured JSON thumbnail prompt for external tools (Midjourney, DALL-E, Flux...)
app.post('/api/generate-thumb-prompt', async (req, res) => {
  const { titre, hook, description, script_complet, language } = req.body;

  const fullScript = [
    script_complet?.intro ?? '',
    ...(script_complet?.developpement ?? []),
    script_complet?.conclusion ?? '',
    script_complet?.cta ?? '',
  ].filter(Boolean).join('\n\n');

  const bannerOptions: Record<string, string> = {
    'Français':   'BREAKING / EXCLUSIF / RÉVÉLATION / ALERTE / CHOC',
    'English':    'BREAKING NEWS / EXCLUSIVE / REVEALED / ALERT / SHOCKING',
    'Español':    'ÚLTIMA HORA / EXCLUSIVO / URGENTE / REVELADO / IMPACTO',
    'Português':  'URGENTE / EXCLUSIVO / REVELADO / ÚLTIMA HORA / IMPACTO',
  };
  const bannerHint = bannerOptions[language] ?? `BREAKING / EXCLUSIVE (adapt to ${language})`;

  const systemPrompt = `You are a world-class YouTube thumbnail art director and viral content strategist. You analyze video scripts deeply and generate ultra-precise JSON prompts for creating viral thumbnails in image generation tools (Midjourney, DALL-E, Flux). You always return ONLY valid JSON — no text before or after, no markdown code blocks.`;

  const userPrompt = `Analyze this YouTube video script and generate a complete structured JSON thumbnail prompt.

VIDEO LANGUAGE: ${language}
TITLE: ${titre}
HOOK: ${hook}
DESCRIPTION: ${description ?? ''}
FULL SCRIPT:
${fullScript.substring(0, 6000)}

Instructions:
1. Deeply analyze the script: extract main subjects/characters, dominant country or location, emotional tone, narrative tension (who wins vs who loses), core message.
2. Generate a thumbnail concept that maximizes click-through rate — dramatic, emotional, impossible to ignore.
3. Adapt ALL text fields (banner, titre_miniature, overlays) to the language "${language}", EXCEPT "prompt_image_final" which MUST always be written in English.
4. Available banner options for ${language}: ${bannerHint}

Return ONLY this JSON (no markdown, no code block, no explanation):

{
  "banner": "[most impactful urgency label in ${language}]",
  "banner_style": "bright red background, bold white text, rounded corners, top centered",

  "titre_miniature": {
    "ligne_1": "[SHOCK KEYWORD in CAPS, 2-3 words max, in ${language} — creates emotional tension]",
    "ligne_2": "[short complement, 3-4 words in ${language}]",
    "style": "neon yellow for ligne_1, white with black outline for ligne_2, ultra-bold Impact or Anton font"
  },

  "personnages": [
    {
      "qui": "[name or visual description of the main subject — person, character, concept visualized as a figure]",
      "position": "left | center | right",
      "expression": "[exact emotion that fits the narrative: shocked / triumphant / furious / determined / betrayed / terrified]",
      "taille": "dominant | secondary",
      "pose": "facing camera | profile looking toward center | bust shot | full body"
    }
  ],

  "background": {
    "ambiance": "[apocalyptic | dramatic | triumphant | revelatory | urgent | explosive]",
    "couleurs": "[dominant color palette derived from script topic, emotion and country if applicable]",
    "elements": ["[specific visual element 1 from script topic]", "[specific visual element 2]", "[specific visual element 3]"],
    "ciel": "[dramatic sky or atmosphere description that fits the video tone exactly]"
  },

  "elements_graphiques": {
    "fleches": true | false,
    "couleur_fleche": "yellow | green | red | white",
    "documents_props": ["[relevant physical prop from script topic]"] ,
    "icones": ["[relevant emoji that amplifies the emotion]"],
    "overlays": ["[dramatic text overlay in ${language} — max 2 words]"]
  },

  "composition": {
    "profondeur": "main subject in sharp foreground, dramatic blurred background",
    "contraste": "very high contrast, maximum color saturation",
    "ratio": "16:9 YouTube standard (1280x720)",
    "style_global": "hyperrealistic 3D or cinematic photo, dramatic orange/red rim lighting, studio quality"
  },

  "prompt_image_final": "[Write here a 150-200 word image generation prompt IN ENGLISH ONLY for Midjourney/DALL-E/Flux. Describe: the main subject with exact expression and pose, the background atmosphere with specific colors and elements, the lighting setup, the composition (rule of thirds, depth), the emotional impact the image should create, and the overall visual style. This prompt must be self-contained and produce a viral YouTube thumbnail when sent to an AI image generator. No text or letters should appear in the generated image.]"
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response');

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    res.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la génération du prompt JSON.' });
  }
});

const PORT = process.env.API_PORT || 4000;
app.listen(PORT, () => console.log(`✅ API server running on http://localhost:${PORT}`));
