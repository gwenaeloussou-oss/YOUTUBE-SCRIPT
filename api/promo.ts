import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function getValidCodes(): string[] {
  // PROMO_CODES env var: comma-separated list, e.g. "LAUNCH30,FRIEND2024,VIP100"
  const raw = process.env.PROMO_CODES ?? '';
  return raw.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code, userId } = req.body as { code: string; userId: string };
  if (!code || !userId) return res.status(400).json({ error: 'Code et userId requis.' });

  const normalizedCode = code.trim().toUpperCase();
  const validCodes = getValidCodes();

  if (!validCodes.includes(normalizedCode)) {
    return res.status(400).json({ error: 'Code promo invalide.' });
  }

  // Check if this user already used any promo code
  const { data: existing } = await supabaseAdmin
    .from('promo_uses')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return res.status(400).json({ error: 'Vous avez déjà utilisé un code promo.' });
  }

  // Activate 30 days standard
  const now = new Date();
  const { data: current } = await supabaseAdmin
    .from('profiles')
    .select('plan_expires_at')
    .eq('id', userId)
    .single();

  const currentExpiry = current?.plan_expires_at ? new Date(current.plan_expires_at) : now;
  const baseDate = currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(baseDate.getTime() + 30 * 86_400_000);

  await supabaseAdmin
    .from('profiles')
    .update({ plan: 'standard', plan_expires_at: newExpiry.toISOString() })
    .eq('id', userId);

  // Log usage
  await supabaseAdmin.from('promo_uses').insert({
    user_id: userId,
    code: normalizedCode,
  });

  return res.status(200).json({
    ok: true,
    message: '30 jours Standard activés !',
    expires_at: newExpiry.toISOString(),
  });
}
