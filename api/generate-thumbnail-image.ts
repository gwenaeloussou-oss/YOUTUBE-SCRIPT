import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getUserPlan } from '../lib/server.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, historyId, prompt } = req.body as { userId?: string; historyId?: string; prompt?: string };
  if (!userId || !historyId || !prompt) return res.status(400).json({ error: 'userId, historyId et prompt requis.' });

  const plan = await getUserPlan(userId);
  if (plan !== 'standard') {
    return res.status(403).json({ error: "La génération d'image est réservée au plan Standard." });
  }

  // Verify ownership and enforce "one image per script"
  const { data: row, error: rowError } = await supabaseAdmin
    .from('history')
    .select('id, thumbnail_url')
    .eq('id', historyId)
    .eq('user_id', userId)
    .single();
  if (rowError || !row) return res.status(404).json({ error: 'Script introuvable.' });
  if (row.thumbnail_url) {
    return res.status(200).json({ thumbnail_url: row.thumbnail_url, cached: true });
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: String(prompt).substring(0, 4000),
        size: '1536x1024',
        n: 1,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => '');
      console.error('[generate-thumbnail-image] OpenAI error:', openaiRes.status, errText);
      return res.status(502).json({ error: "Erreur lors de la génération de l'image." });
    }

    const openaiData = await openaiRes.json();
    const b64 = openaiData.data?.[0]?.b64_json as string | undefined;
    if (!b64) return res.status(502).json({ error: "Réponse invalide de l'IA image." });

    const buffer = Buffer.from(b64, 'base64');
    const path = `${userId}/${historyId}.png`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('thumbnails')
      .upload(path, buffer, { contentType: 'image/png', upsert: true });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseAdmin.storage.from('thumbnails').getPublicUrl(path);
    const thumbnailUrl = publicUrlData.publicUrl;

    await supabaseAdmin.from('history').update({ thumbnail_url: thumbnailUrl }).eq('id', historyId);

    return res.status(200).json({ thumbnail_url: thumbnailUrl, cached: false });
  } catch (err) {
    console.error('[generate-thumbnail-image] error:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}
