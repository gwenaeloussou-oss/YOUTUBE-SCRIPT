import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { chunkEbookText, ingestEbookChunks, type PlatformId } from '../lib/server.js';

const ADMIN_EMAIL = 'gwenaeloussou@gmail.com';
const ALL_PLATFORMS: PlatformId[] = ['youtube_long', 'youtube_short', 'facebook', 'linkedin', 'facebook_comment'];

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function verifyAdmin(req: VercelRequest): Promise<boolean> {
  const userId = typeof req.body?._userId === 'string' ? req.body._userId : '';
  if (!userId) return false;
  const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !user) return false;
  return user.email === ADMIN_EMAIL;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  try {
    if (!(await verifyAdmin(req))) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
  } catch (err) {
    console.error('[admin-knowledge] verifyAdmin threw:', err);
    return res.status(500).json({ error: `Erreur auth: ${String(err)}` });
  }

  const { action, title, platformTags, content, ebookId } = req.body as {
    action: string;
    title?: string;
    platformTags?: string[];
    content?: string;
    ebookId?: string;
  };

  try {
    if (action === 'list') {
      const { data: ebooks, error: ebooksError } = await supabaseAdmin
        .from('ebooks')
        .select('id, title, platform_tags, created_at')
        .order('created_at', { ascending: false });
      if (ebooksError) throw ebooksError;

      const { data: chunkRows } = await supabaseAdmin.from('knowledge_chunks').select('ebook_id');
      const countMap = new Map<string, number>();
      for (const row of chunkRows ?? []) {
        countMap.set(row.ebook_id, (countMap.get(row.ebook_id) ?? 0) + 1);
      }

      return res.status(200).json({
        ebooks: (ebooks ?? []).map(e => ({ ...e, chunk_count: countMap.get(e.id) ?? 0 })),
      });
    }

    if (action === 'add') {
      if (!title?.trim() || !content?.trim()) {
        return res.status(400).json({ error: 'Titre et contenu requis.' });
      }
      const validTags = (platformTags ?? []).filter((p): p is PlatformId => ALL_PLATFORMS.includes(p as PlatformId));

      const { data: ebook, error: insertError } = await supabaseAdmin
        .from('ebooks')
        .insert({ title: title.trim(), platform_tags: validTags })
        .select('id')
        .single();
      if (insertError || !ebook) throw insertError ?? new Error('Insert failed');

      const chunks = chunkEbookText(content);
      if (chunks.length === 0) {
        return res.status(400).json({ error: 'Aucun contenu exploitable trouvé dans ce texte.' });
      }
      const indexed = await ingestEbookChunks(ebook.id, chunks, validTags);

      return res.status(200).json({ ok: true, ebookId: ebook.id, chunksFound: chunks.length, chunksIndexed: indexed });
    }

    if (action === 'delete' && ebookId) {
      await supabaseAdmin.from('ebooks').delete().eq('id', ebookId);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Action inconnue: ${action}` });
  } catch (err) {
    console.error('[admin-knowledge] handler error:', err);
    return res.status(500).json({ error: `Erreur serveur: ${String(err)}` });
  }
}
