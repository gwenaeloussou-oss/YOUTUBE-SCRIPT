import type { VercelRequest, VercelResponse } from '@vercel/node';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
};

function extractTextFromHtml(html: string): string {
  // Remove non-content elements
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Try progressively broader content selectors
  const selectors = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /class="[^"]*(?:article|post|content|story|entry|text|body)[^"]*"[^>]*>([\s\S]{500,}?)<\/(?:div|section|article)>/i,
    /id="[^"]*(?:article|post|content|story|entry|text|body)[^"]*"[^>]*>([\s\S]{500,}?)<\/(?:div|section|article)>/i,
  ];

  let source = '';
  for (const sel of selectors) {
    const m = cleaned.match(sel);
    if (m) { source = m[0]; break; }
  }
  if (!source) source = cleaned;

  // Extract text from paragraphs and headings
  const paragraphs: string[] = [];
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

  return paragraphs.join('\n\n');
}

// Strategy 1: Direct fetch
async function tryDirectFetch(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const text = extractTextFromHtml(html);
  if (text.length < 100) throw new Error('Not enough content extracted');
  return text;
}

// Strategy 2: Jina AI Reader (free, handles JS-rendered pages and many protections)
async function tryJinaReader(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const res = await fetch(jinaUrl, {
    headers: {
      'Accept': 'text/plain',
      'X-No-Cache': 'true',
    },
  });
  if (!res.ok) throw new Error(`Jina ${res.status}`);
  const text = await res.text();
  if (text.length < 100) throw new Error('Jina returned empty content');
  // Jina returns markdown — clean it up
  const cleaned = text
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/^\s*[-*>]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned;
}

// Strategy 3: Google Cache
async function tryGoogleCache(url: string): Promise<string> {
  const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
  const res = await fetch(cacheUrl, { headers: HEADERS });
  if (!res.ok) throw new Error(`Cache ${res.status}`);
  const html = await res.text();
  const text = extractTextFromHtml(html);
  if (text.length < 100) throw new Error('Cache empty');
  return text;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const { url } = req.query as { url: string };
  if (!url?.startsWith('http')) { res.status(400).json({ error: 'URL invalide.' }); return; }

  const strategies = [
    { name: 'direct', fn: () => tryDirectFetch(url) },
    { name: 'jina', fn: () => tryJinaReader(url) },
    { name: 'cache', fn: () => tryGoogleCache(url) },
  ];

  for (const strategy of strategies) {
    try {
      const text = await strategy.fn();
      return res.json({ text: text.substring(0, 15000), wordCount: text.split(/\s+/).length, source: strategy.name });
    } catch {
      // try next strategy
    }
  }

  res.status(404).json({
    error: "Impossible d'extraire le contenu de cet article. Le site est protégé par un paywall ou bloque les robots. Essayez de coller le texte directement dans l'onglet \"Texte\".",
  });
}
