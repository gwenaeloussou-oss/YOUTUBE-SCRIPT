import type { VercelRequest, VercelResponse } from '@vercel/node';

const CHARIOW_API_KEY = process.env.CHARIOW_API_KEY!;
const PRODUCT_ID = 'prd_cdmpssyt';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, email, firstName, lastName, phone, countryCode } = req.body as {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    countryCode?: string;
  };

  if (!userId || !email || !firstName || !lastName || !phone) {
    return res.status(400).json({ error: 'Champs requis manquants.' });
  }

  const appUrl = process.env.APP_URL || 'https://youscript-ai.vercel.app';

  try {
    const response = await fetch('https://api.chariow.com/v1/checkout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CHARIOW_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: PRODUCT_ID,
        email,
        first_name: firstName,
        last_name: lastName,
        phone: {
          number: phone.replace(/\D/g, ''),
          country_code: countryCode || 'CI',
        },
        redirect_url: `${appUrl}/?payment=success`,
        custom_metadata: { userId },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({ error: data.message || 'Erreur Chariow.' });
    }

    if (data.data?.step === 'payment' && data.data?.payment?.checkout_url) {
      return res.status(200).json({ checkout_url: data.data.payment.checkout_url });
    }

    return res.status(200).json({ step: data.data?.step });
  } catch {
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}
