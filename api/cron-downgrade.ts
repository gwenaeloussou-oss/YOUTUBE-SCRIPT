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

  // Get admin user ID to exclude from downgrade
  const { data: adminUser } = await supabaseAdmin.auth.admin.getUserByEmail('gwenaeloussou@gmail.com');
  const adminId = adminUser?.user?.id;

  let query = supabaseAdmin
    .from('profiles')
    .update({ plan: 'free', plan_expires_at: null })
    .eq('plan', 'standard')
    .lt('plan_expires_at', graceEnd.toISOString());

  if (adminId) query = query.neq('id', adminId);

  const { data, error } = await query.select('id');

  if (error) {
    console.error('cron-downgrade error:', error);
    return res.status(500).json({ error: error.message });
  }

  const downgraded = data?.length ?? 0;
  console.log(`Downgraded ${downgraded} users past grace period`);

  // Delete history rows older than 30 days
  const cutoff30 = new Date(Date.now() - 30 * 86_400_000);
  const { error: histError, count: deletedHistory } = await supabaseAdmin
    .from('history')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff30.toISOString());

  if (histError) console.error('cron-downgrade history cleanup error:', histError);
  else console.log(`Deleted ${deletedHistory ?? 0} history rows older than 30 days`);

  return res.status(200).json({ downgraded, history_deleted: deletedHistory ?? 0 });
}
