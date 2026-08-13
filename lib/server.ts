// Shared utilities for all Vercel serverless functions
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

function getSupabaseAdmin() {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768; // pinned to match knowledge_chunks.embedding column (model defaults to 3072 otherwise)
let genAI: GoogleGenAI | null = null;
function getGenAI() {
  if (!genAI) genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  return genAI;
}

export async function embedText(text: string): Promise<number[]> {
  const ai = getGenAI();
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: [text],
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });
  return response.embeddings?.[0]?.values ?? [];
}

const GRACE_DAYS = 5; // days after expiry before hard downgrade
export const FREE_LIMIT = 5;
export const STANDARD_LIMIT = 60;
export const STANDARD_LIMIT_ANNUAL = 100;

export async function getMonthlyUsageServer(userId: string): Promise<number> {
  const db = getSupabaseAdmin();
  const d = new Date();
  const { data } = await db
    .from('usage')
    .select('count')
    .eq('user_id', userId)
    .eq('year', d.getFullYear())
    .eq('month', d.getMonth())
    .maybeSingle();
  return data?.count ?? 0;
}

export async function incrementMonthlyUsageServer(userId: string): Promise<number> {
  const db = getSupabaseAdmin();
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  const current = await getMonthlyUsageServer(userId);
  const next = current + 1;
  if (current === 0) {
    await db.from('usage').insert({ user_id: userId, year, month, count: next });
  } else {
    await db.from('usage').update({ count: next }).eq('user_id', userId).eq('year', year).eq('month', month);
  }
  return next;
}

export async function saveHistoryServer(userId: string, item: {
  sourceType: string;
  sourceUrl?: string;
  language: string;
  wordCount: number;
  titre: string;
  result: object;
  // Optional multi-platform fields (§8) — only sent by generate-content.ts.
  // Left out of the insert entirely when absent, so the existing video/article/text
  // flow above is completely unaffected even if these DB columns don't exist yet.
  platform?: PlatformId;
  offerId?: string;
  objective?: ContentObjective;
}): Promise<{ id: string; date: string } | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('history')
    .insert({
      user_id: userId,
      source_type: item.sourceType,
      source_url: item.sourceUrl ?? null,
      language: item.language,
      word_count: item.wordCount,
      titre: item.titre,
      result: item.result,
      ...(item.platform ? { platform: item.platform } : {}),
      ...(item.offerId ? { offer_id: item.offerId } : {}),
      ...(item.objective ? { objective: item.objective } : {}),
    })
    .select('id, created_at')
    .single();
  if (error) console.error('[saveHistoryServer]', error.code, error.message);
  if (!data) return null;
  return { id: data.id, date: data.created_at };
}

export async function getUserPlan(userId?: string): Promise<'free' | 'standard'> {
  if (!userId) return 'free';
  const db = getSupabaseAdmin();
  const { data } = await db.from('profiles').select('plan, plan_expires_at').eq('id', userId).single();
  if (!data || data.plan !== 'standard') return 'free';

  if (data.plan_expires_at) {
    const expires = new Date(data.plan_expires_at);
    const graceEnd = new Date(expires.getTime() + GRACE_DAYS * 86_400_000);
    if (Date.now() > graceEnd.getTime()) {
      // Past grace period — auto-downgrade
      await db.from('profiles').update({ plan: 'free', plan_expires_at: null }).eq('id', userId);
      return 'free';
    }
  }
  return 'standard';
}

export async function getUserBillingCycle(userId?: string): Promise<'monthly' | 'annual'> {
  if (!userId) return 'monthly';
  const db = getSupabaseAdmin();
  const { data } = await db.from('profiles').select('billing_cycle').eq('id', userId).maybeSingle();
  return data?.billing_cycle === 'annual' ? 'annual' : 'monthly';
}

export function extractVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

export async function fetchYouTubeMetadata(videoId: string): Promise<string> {
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

export async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  const CLIENT_VERSION = '20.10.38';
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
  if (!Array.isArray(tracks) || tracks.length === 0) return fetchYouTubeMetadata(videoId);
  const captionUrl = tracks[0].baseUrl;
  const captionRes = await fetch(captionUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!captionRes.ok) throw new Error('Caption fetch failed');
  const xml = await captionRes.text();
  const segments: string[] = [];
  const textRegex = /<text[^>]*>([^<]*)<\/text>/g;
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
  let match: RegExpExecArray | null;
  while ((match = textRegex.exec(xml)) !== null) {
    const decoded = match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n/g, ' ').trim();
    if (decoded) segments.push(decoded);
  }
  if (segments.length === 0) {
    while ((match = pRegex.exec(xml)) !== null) {
      const text = match[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
      if (text) segments.push(text);
    }
  }
  const transcript = segments.join(' ').replace(/\s+/g, ' ').trim();
  return transcript || fetchYouTubeMetadata(videoId);
}

export async function braveWebSearch(query: string, apiKey: string, lang: string): Promise<string> {
  const searchLang = ({ 'Français': 'fr', 'English': 'en', 'Español': 'es', 'Português': 'pt' } as Record<string, string>)[lang] ?? 'fr';
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=6&search_lang=${searchLang}&safesearch=moderate`,
    { headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey } }
  );
  if (!res.ok) throw new Error(`Brave Search error ${res.status}`);
  const data = await res.json() as any;
  const results: any[] = data.web?.results ?? [];
  if (results.length === 0) return '';
  return results.map((r: any, i: number) => `[${i + 1}] ${r.title}\n${r.description ?? ''}\n(${r.url})`).join('\n\n');
}

export function buildSearchQuery(source: { articleText?: string; transcript?: string; url?: string }): string {
  if (source.transcript?.startsWith('VIDEO TITLE:')) {
    const m = source.transcript.match(/VIDEO TITLE:\s*(.+)/);
    return m?.[1]?.trim() ?? source.transcript.substring(0, 120);
  }
  const raw = source.articleText ?? source.transcript ?? source.url ?? '';
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 150);
}

export const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  'Français':  'Write everything in French (fr). Every single word of the script, title, description, hook and CTA must be in French.',
  'English':   'Write everything in English (en). Every single word of the script, title, description, hook and CTA must be in English.',
  'Español':   'Write everything in Spanish (es). Every single word of the script, title, description, hook and CTA must be in Spanish.',
  'Português': 'Write everything in Portuguese (pt). Every single word of the script, title, description, hook and CTA must be in Portuguese.',
};

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM GENERATORS — offer-driven, multi-platform content (§5/§6/§7 spec)
// Separate pipeline from the source-driven YouTube generator above (api/generate.ts).
// Nothing here is called by the existing video/article/text flow.
// ═══════════════════════════════════════════════════════════════════════════

export type PlatformId = 'youtube_long' | 'youtube_short' | 'facebook' | 'linkedin' | 'facebook_comment';
export type ContentObjective = 'notoriete' | 'engagement' | 'conversion' | 'education';

export type OfferInput = {
  name: string;
  sector?: string;
  description?: string;
  target?: string;
  promise?: string;
  differentiators?: string;
  proof?: string;
  commercialTerms?: string;
  cta?: string;
  brandTone?: string;
  language: string;
};

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  youtube_long: 'YouTube (format long)',
  youtube_short: 'Short / Reels / TikTok',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  facebook_comment: 'Commentaire Facebook (stratégique)',
};

// Copywriting frameworks + per-platform best practices, embedded directly in the
// prompt as a stand-in "knowledge base" until a real ebook/RAG pipeline is built (§6).
const COPYWRITING_FRAMEWORKS = `
FRAMEWORKS DE PERSUASION À APPLIQUER SELON LE CONTEXTE (méthode, pas à recopier) :
- AIDA : Attention → Intérêt → Désir → Action.
- PAS : Problème → Agitation → Solution.
- BAB : Before → After → Bridge (situation actuelle → situation désirée → comment y arriver).
- Preuve sociale, rareté, autorité, réciprocité : à utiliser avec parcimonie et honnêteté, jamais d'urgence fabriquée ou de mensonge.
- Un hook efficace = une promesse claire, une tension, ou une affirmation contre-intuitive — jamais une généralité vague.
`.trim();

const PLATFORM_KNOWLEDGE: Record<PlatformId, string> = {
  youtube_long: `
GUIDE SCRIPT YOUTUBE LONG FORMAT :
- Structure : HOOK (0-15s, la révélation la plus forte en premier) → PROMESSE/PLAN → DÉVELOPPEMENT (preuves concrètes, exemples) → BOUCLES DE RÉTENTION (annoncer ce qui vient) → CONCLUSION → CTA.
- Techniques de rétention : boucles ouvertes (teaser une info sans la donner tout de suite), pattern interrupts (changement de rythme/angle).
- Ton conversationnel, écrit pour être parlé à voix haute, jamais de "Dans cette vidéo...".
`.trim(),
  youtube_short: `
GUIDE SCRIPT VIDÉO COURTE (Reels/Shorts/TikTok, 20-45s) :
- Structure : HOOK CHOC (0-3s, arrête le scroll) → VALEUR UNIQUE ET RAPIDE → PUNCHLINE → CTA.
- Une seule idée par vidéo. Rythme rapide, phrases courtes, zéro remplissage.
- Le texte à l'écran doit pouvoir se comprendre seul, sans le son.
`.trim(),
  facebook: `
GUIDE POST FACEBOOK :
- Première phrase = accroche qui stoppe le défilement, lisible sans avoir à cliquer sur "voir plus".
- Formats qui marchent : storytelling personnel, question ouverte, avant/après, offre directe.
- Ton chaleureux et communautaire, mise en forme aérée, émojis pertinents mais pas excessifs.
- CTA clair en fin de post (commenter, partager, cliquer, envoyer un message).
`.trim(),
  linkedin: `
GUIDE POST LINKEDIN :
- Anatomie : 1re ligne = hook fort qui donne envie de cliquer sur "voir plus" → saut de ligne → corps aéré en phrases courtes → CTA soft en fin.
- Formats qui marchent : retour d'expérience personnel, opinion tranchée, liste de valeur actionnable, étude de cas chiffrée.
- Ton professionnel mais humain, zéro jargon creux, zéro superlatif vide ("incroyable", "révolutionnaire").
`.trim(),
  facebook_comment: `
GUIDE COMMENTAIRE FACEBOOK STRATÉGIQUE (méthode "CopyGoat") :
- Principe : Facebook pousse les comptes les plus ACTIFS, pas les plus talentueux. Commenter intelligemment sur les posts viraux de sa niche est le levier de visibilité le plus rapide et gratuit — plus rapide que publier.
- Structure obligatoire en 3 temps : HOOK (phrase forte ou drôle qui capte l'attention dès le premier mot) → INSIGHT (une idée ou un angle nouveau, pas une simple approbation) → HUMAN TOUCH (chute humaine, émotionnelle ou ironique qui rend le commentaire mémorable).
- Un bon commentaire déclenche l'une de ces 3 émotions qui provoquent le réflexe "clic sur le profil" : ADMIRATION ("il/elle dit des choses intelligentes"), IDENTIFICATION ("c'est exactement ce que je pense"), AMUSEMENT ("cette personne est drôle"). Un commentaire plat ("haha", "exactement", "je valide") n'envoie aucun signal et ne sert à rien.
- 7 archétypes de commentaires à alterner : Autorité (révèle un insight peu connu), Contradiction (nuance une idée reçue avec classe, sans agressivité), Story courte (une micro-anecdote personnelle en une phrase), Insightful (tire une leçon d'une phrase du post), Humoristique (fait sourire avec une touche d'autodérision), Émotionnel (montre qu'on ressent profondément le message), Ego Trigger (titille gentiment l'orgueil du lecteur ou de l'auteur).
- Le commentaire ne vend jamais directement l'offre : il installe l'autorité et la personnalité de l'auteur pour donner envie de cliquer sur son profil. Le lien avec l'offre reste implicite (ton, angle, expertise démontrée), jamais un CTA de vente.
- Timing : rappeler dans la sortie que ce commentaire est plus efficace posté dans les 5 à 10 premières minutes suivant la publication du post visé.
`.trim(),
};

const OBJECTIVE_GUIDANCE: Record<ContentObjective, string> = {
  notoriete: "Objectif NOTORIÉTÉ : privilégier une idée mémorable et partageable, moins de vente directe, plus de valeur ou de divertissement.",
  engagement: "Objectif ENGAGEMENT : poser une question ou une opinion qui donne envie de commenter, inviter explicitement à réagir.",
  conversion: "Objectif CONVERSION : mettre en avant l'offre commerciale et la preuve sociale, CTA direct et clair vers l'action souhaitée.",
  education: "Objectif ÉDUCATION : enseigner un point de valeur concret et actionnable, posture d'expert, CTA doux.",
};

function buildOfferBlock(offer: OfferInput): string {
  const lines = [
    `Nom de l'offre : ${offer.name}`,
    offer.sector && `Secteur : ${offer.sector}`,
    offer.description && `Description : ${offer.description}`,
    offer.target && `Cible : ${offer.target}`,
    offer.promise && `Promesse principale : ${offer.promise}`,
    offer.differentiators && `Différenciateurs : ${offer.differentiators}`,
    offer.proof && `Preuve / résultats : ${offer.proof}`,
    offer.commercialTerms && `Offre commerciale : ${offer.commercialTerms}`,
    offer.cta && `Appel à l'action souhaité : ${offer.cta}`,
    offer.brandTone && `Ton de marque : ${offer.brandTone}`,
  ].filter(Boolean);
  return lines.join('\n');
}

export type KnowledgeChunk = { content: string; section: string | null };

// Retrieval step of the RAG pipeline (§6.2): embeds the query, finds the closest
// chunks tagged for this platform via pgvector cosine similarity. Returns an empty
// array (never throws) when nothing is indexed yet or the embedding call fails —
// callers fall back to the hardcoded PLATFORM_KNOWLEDGE in that case.
export async function retrieveKnowledge(platform: PlatformId, query: string, matchCount = 4): Promise<KnowledgeChunk[]> {
  try {
    const embedding = await embedText(query);
    if (embedding.length === 0) return [];
    const db = getSupabaseAdmin();
    const { data, error } = await db.rpc('match_knowledge_chunks', {
      query_embedding: embedding,
      match_platform: platform,
      match_count: matchCount,
    });
    if (error) { console.error('[retrieveKnowledge]', error.message); return []; }
    return (data ?? []) as KnowledgeChunk[];
  } catch (err) {
    console.error('[retrieveKnowledge] failed:', err);
    return [];
  }
}

// Ingestion step (§6.2): splits raw ebook text into ~500-800 token chunks, tracking
// the nearest short heading-like line above each chunk as its section label.
export function chunkEbookText(text: string, maxChars = 2800): KnowledgeChunk[] {
  const isHeading = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 90) return false;
    return !/[.!?,;:]$/.test(trimmed);
  };

  const chunks: KnowledgeChunk[] = [];
  let currentSection: string | null = null;
  let buffer: string[] = [];
  let bufferChars = 0;

  const flush = () => {
    const content = buffer.join('\n').trim();
    if (content.length > 40) chunks.push({ section: currentSection, content });
    buffer = [];
    bufferChars = 0;
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (isHeading(line) && (buffer.length === 0 || bufferChars > 200)) {
      flush();
      currentSection = line;
      continue;
    }
    buffer.push(line);
    bufferChars += line.length;
    if (bufferChars >= maxChars) flush();
  }
  flush();
  return chunks;
}

// Embeds and stores each chunk for an ebook. Returns how many were successfully indexed.
export async function ingestEbookChunks(ebookId: string, chunks: KnowledgeChunk[], platformTags: PlatformId[]): Promise<number> {
  const db = getSupabaseAdmin();
  let inserted = 0;
  for (const chunk of chunks) {
    const embedding = await embedText(chunk.content);
    if (embedding.length === 0) continue;
    const { error } = await db.from('knowledge_chunks').insert({
      ebook_id: ebookId,
      section: chunk.section,
      platform_tags: platformTags,
      content: chunk.content,
      embedding,
    });
    if (!error) inserted++;
    else console.error('[ingestEbookChunks]', error.message);
  }
  return inserted;
}

export function buildPlatformSystemPrompt(platform: PlatformId, language: string, retrievedChunks: KnowledgeChunk[] = []): string {
  const langInstruction = LANGUAGE_INSTRUCTIONS[language] ?? `Write everything in ${language}.`;
  // RAG chunks from your uploaded guides take priority; fall back to the embedded
  // frameworks (§7 defaults) when nothing has been indexed yet for this platform.
  const knowledgeBlock = retrievedChunks.length > 0
    ? retrievedChunks.map(c => (c.section ? `[${c.section}]\n${c.content}` : c.content)).join('\n\n')
    : PLATFORM_KNOWLEDGE[platform];

  return `Tu es un expert en marketing de contenu et copywriting. ${langInstruction}
Tu t'appuies sur les CONNAISSANCES DE RÉFÉRENCE ci-dessous comme méthode de structuration — ne les recopie jamais mot pour mot, elles servent de guide, pas de contenu à copier.

CONNAISSANCES DE RÉFÉRENCE :
${COPYWRITING_FRAMEWORKS}

${knowledgeBlock}

Règles : contenu 100% original et spécifique à l'offre donnée, jamais générique, jamais de remplissage. CTA toujours clair. Varie les angles entre les variantes demandées. Réponds STRICTEMENT en JSON valide, sans texte avant ou après.`;
}

export function buildPlatformUserPrompt(platform: PlatformId, offer: OfferInput, objective: ContentObjective, variantCount: number): string {
  const offerBlock = buildOfferBlock(offer);
  const objectiveLine = OBJECTIVE_GUIDANCE[objective];
  const langInstruction = LANGUAGE_INSTRUCTIONS[offer.language] ?? `Write everything in ${offer.language}.`;

  const base = `OFFRE DU CLIENT :
${offerBlock}

${objectiveLine}

LANGUE DE SORTIE : ${langInstruction}
`;

  if (platform === 'youtube_long') {
    return `${base}
Génère ${variantCount} script(s) vidéo YouTube long format distinct(s) pour cette offre, avec des angles différents.
Chaque script suit : HOOK (0-15s) → PROMESSE/PLAN → DÉVELOPPEMENT → RÉTENTION → CTA.

Réponds UNIQUEMENT en JSON valide :
{
  "variants": [
    {
      "titre": "titre accrocheur",
      "angle": "angle distinctif de cette variante",
      "sections": [
        { "nom": "Hook", "texte": "...", "note_visuelle": "suggestion de plan/visuel" },
        { "nom": "Développement", "texte": "...", "note_visuelle": "..." },
        { "nom": "Conclusion", "texte": "...", "note_visuelle": "..." }
      ],
      "cta": "...",
      "duree_estimee": "ex: 6-8 min"
    }
  ]
}`;
  }

  if (platform === 'youtube_short') {
    return `${base}
Génère ${variantCount} script(s) de vidéo courte (Reels/Shorts/TikTok, 20-45s) distinct(s) pour cette offre.
Structure : HOOK choc (0-3s) → valeur unique rapide → punchline → CTA.

Réponds UNIQUEMENT en JSON valide :
{
  "variants": [
    { "hook": "...", "texte_parle": "...", "texte_ecran": "...", "cta": "...", "duree": "ex: 25s" }
  ]
}`;
  }

  if (platform === 'facebook') {
    return `${base}
Génère ${variantCount} post(s) Facebook distinct(s) pour cette offre, avec des angles variés (storytelling, question/engagement, offre directe).

Réponds UNIQUEMENT en JSON valide :
{
  "variants": [
    { "type": "storytelling | question | offre_directe", "accroche": "...", "corps": "...", "cta": "..." }
  ]
}`;
  }

  if (platform === 'linkedin') {
    return `${base}
Génère ${variantCount} post(s) LinkedIn distinct(s) pour cette offre, avec des angles variés (retour d'expérience, opinion, liste de valeur, étude de cas).

Réponds UNIQUEMENT en JSON valide :
{
  "variants": [
    { "angle": "retour_experience | opinion | liste_valeur | etude_de_cas", "hook": "...", "corps": "...", "cta": "...", "hashtags": ["...", "..."] }
  ]
}`;
  }

  // facebook_comment
  return `${base}
Génère ${variantCount} commentaire(s) Facebook stratégique(s) distinct(s), prêts à poster sous un post viral (d'un tiers) dans la niche de cette offre — PAS un post à publier soi-même.
Chaque commentaire applique la structure CopyGoat : HOOK → INSIGHT → HUMAN TOUCH, et vise à déclencher l'admiration, l'identification ou l'amusement pour donner envie de cliquer sur le profil de l'auteur.
Utilise ${variantCount >= 3 ? 'des archétypes variés parmi' : 'un ou deux archétypes parmi'} : autorite, contradiction, story_courte, insightful, humoristique, emotionnel, ego_trigger.
Ne vends jamais l'offre directement dans le commentaire — le lien avec l'offre doit rester implicite (ton, expertise, angle).

Réponds UNIQUEMENT en JSON valide :
{
  "variants": [
    { "type": "autorite | contradiction | story_courte | insightful | humoristique | emotionnel | ego_trigger", "commentaire": "...", "explication": "pourquoi ce commentaire déclenche le clic profil" }
  ]
}`;
}
