// Shared utilities for all Vercel serverless functions
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const GRACE_DAYS = 5; // days after expiry before hard downgrade
export const FREE_LIMIT = 5;
export const STANDARD_LIMIT = 60;

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
