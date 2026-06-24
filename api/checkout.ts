import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const CHARIOW_API_KEY = process.env.CHARIOW_API_KEY!;
const PRODUCT_ID = 'prd_cdmpssyt';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, email } = req.body as { userId: string; email: string };
  if (!userId || !email) return res.status(400).json({ error: 'userId et email requis.' });

  // Fetch user profile stored at signup
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('name, phone, country')
    .eq('id', userId)
    .single();

  const fullName = profile?.name || email.split('@')[0] || 'User';
  const nameParts = fullName.trim().split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || nameParts[0];
  const phoneLocal = profile?.phone?.replace(/\D/g, '') || '';
  const countryCode = profile?.country || 'CI';

  const appUrl = process.env.APP_URL || 'https://youscript-ai.vercel.app';

  // Build request body — only include phone if we have valid data
  const body: Record<string, unknown> = {
    product_id: PRODUCT_ID,
    email,
    first_name: firstName,
    last_name: lastName,
    redirect_url: `${appUrl}/?payment=success`,
    custom_metadata: { userId },
  };
  if (phoneLocal.length >= 6) {
    body.phone = { number: phoneLocal, country_code: countryCode };
  }

  try {
    const response = await fetch('https://api.chariow.com/v1/checkout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CHARIOW_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) return res.status(400).json({ error: data.message || 'Erreur Chariow.' });

    if (data.data?.step === 'payment' && data.data?.payment?.checkout_url) {
      return res.status(200).json({ checkout_url: data.data.payment.checkout_url });
    }
    return res.status(200).json({ step: data.data?.step });
  } catch {
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}
