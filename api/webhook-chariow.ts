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
    sale?: {
      id?: string;
      amount?: number;
      currency?: string;
      email?: string;
      custom_metadata?: { userId?: string };
    };
  };

  if (event === 'successful.sale') {
    const userId = sale?.custom_metadata?.userId;

    if (userId) {
      // Extend plan by 30 days
      const { data: current } = await supabaseAdmin
        .from('profiles')
        .select('plan_expires_at')
        .eq('id', userId)
        .single();

      const now = new Date();
      const currentExpiry = current?.plan_expires_at ? new Date(current.plan_expires_at) : now;
      const baseDate = currentExpiry > now ? currentExpiry : now;
      const newExpiry = new Date(baseDate.getTime() + 30 * 86_400_000);

      await supabaseAdmin
        .from('profiles')
        .update({ plan: 'standard', plan_expires_at: newExpiry.toISOString() })
        .eq('id', userId);

      // Log payment
      await supabaseAdmin.from('payments').insert({
        user_id: userId,
        chariow_sale_id: sale?.id ?? null,
        amount: sale?.amount ?? null,
        currency: sale?.currency ?? 'XOF',
        email: sale?.email ?? null,
      });
    }
  }

  return res.status(200).json({ ok: true });
}
