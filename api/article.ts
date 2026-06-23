import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const { url } = req.query as { url: string };
  if (!url?.startsWith('http')) { res.status(400).json({ error: 'URL invalide.' }); return; }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr,en;q=0.9',
      },
    });
    if (!response.ok) { res.status(400).json({ error: `Impossible d'accéder à l'article (${response.status}).` }); return; }

    const html = await response.text();
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    const paragraphs: string[] = [];
    const articleMatch = cleaned.match(/<article[\s\S]*?<\/article>/i);
    const mainMatch = cleaned.match(/<main[\s\S]*?<\/main>/i);
    const source = articleMatch?.[0] ?? mainMatch?.[0] ?? cleaned;
    const pRegex = /<(?:p|h1|h2|h3|h4|blockquote|li)[^>]*>([\s\S]*?)<\/(?:p|h1|h2|h3|h4|blockquote|li)>/gi;
    let match: RegExpExecArray | null;
    while ((match = pRegex.exec(source)) !== null) {
      const text = match[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 30) paragraphs.push(text);
    }

    if (paragraphs.length === 0) { res.status(404).json({ error: "Impossible d'extraire le contenu de cet article. Le site est peut-être protégé." }); return; }
    const text = paragraphs.join('\n\n');
    res.json({ text, wordCount: text.split(/\s+/).length });
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération de l'article." });
  }
}
