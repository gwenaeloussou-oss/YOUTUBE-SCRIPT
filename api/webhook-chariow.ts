import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function verifyWebhookSignature(req: VercelRequest): boolean {
  const secret = process.env.CHARIOW_WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured — log warning but allow (backward compat)
    console.warn('[webhook] CHARIOW_WEBHOOK_SECRET not set — skipping signature check');
    return true;
  }

  // Chariow sends the signature in x-chariow-signature as HMAC-SHA256 of the raw body
  const signature = req.headers['x-chariow-signature'] as string | undefined;
  if (!signature) {
    // Fallback: also accept a simple bearer token in Authorization header
    const auth = req.headers['authorization'] as string | undefined;
    if (auth === `Bearer ${secret}`) return true;
    console.error('[webhook] Missing signature header');
    return false;
  }

  const rawBody = JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!isValid) console.error('[webhook] Invalid signature');
  return isValid;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!verifyWebhookSignature(req)) return res.status(401).json({ error: 'Invalid signature' });

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
