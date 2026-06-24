import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { event, sale } = req.body as {
    event: string;
    sale?: { custom_metadata?: { userId?: string } };
  };

  if (event === 'successful.sale') {
    const userId = sale?.custom_metadata?.userId;
    if (userId) {
      await supabaseAdmin
        .from('profiles')
        .update({ plan: 'standard' })
        .eq('id', userId);
    }
  }

  return res.status(200).json({ ok: true });
}
