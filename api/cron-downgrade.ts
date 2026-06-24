import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Runs daily — downgrades Standard users past the 5-day grace period
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const graceEnd = new Date(Date.now() - 5 * 86_400_000); // now - 5 days

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ plan: 'free', plan_expires_at: null })
    .eq('plan', 'standard')
    .lt('plan_expires_at', graceEnd.toISOString())
    .select('id');

  if (error) {
    console.error('cron-downgrade error:', error);
    return res.status(500).json({ error: error.message });
  }

  console.log(`Downgraded ${data?.length ?? 0} users past grace period`);
  return res.status(200).json({ downgraded: data?.length ?? 0 });
}
