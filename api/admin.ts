import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'gwenaeloussou@gmail.com';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function verifyAdmin(req: VercelRequest): Promise<boolean> {
  const userId = typeof req.body?._userId === 'string' ? req.body._userId : '';
  if (!userId) return false;
  // Service role can look up any user by ID — no JWT needed
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
    console.error('[admin] verifyAdmin threw:', err);
    return res.status(500).json({ error: `Erreur auth: ${String(err)}` });
  }

  const { action, userId, plan, password } = req.body as {
    action: string;
    userId?: string;
    plan?: string;
    password?: string;
    _token?: string;
  };

  try {
    if (action === 'users') {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const users = authUsers?.users ?? [];

      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, name, plan, plan_expires_at, phone, dial_code, country');

      const { data: usageRows } = await supabaseAdmin
        .from('usage')
        .select('user_id, count, year, month');

      const { data: paymentRows } = await supabaseAdmin
        .from('payments')
        .select('user_id, amount, currency, created_at, chariow_sale_id')
        .order('created_at', { ascending: false });

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const monthStart = new Date(currentYear, currentMonth, 1).toISOString();

      const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));
      const usageMap = new Map(
        (usageRows ?? [])
          .filter(u => u.year === currentYear && u.month === currentMonth)
          .map(u => [u.user_id, u.count])
      );
      const totalScriptsMap = new Map<string, number>();
      for (const u of usageRows ?? []) {
        totalScriptsMap.set(u.user_id, (totalScriptsMap.get(u.user_id) ?? 0) + u.count);
      }

      // Per-user payment stats
      const paymentCountMap = new Map<string, number>();
      const paymentTotalMap = new Map<string, number>();
      const lastPaymentMap = new Map<string, string>();
      for (const p of paymentRows ?? []) {
        if (!p.user_id) continue;
        paymentCountMap.set(p.user_id, (paymentCountMap.get(p.user_id) ?? 0) + 1);
        paymentTotalMap.set(p.user_id, (paymentTotalMap.get(p.user_id) ?? 0) + (p.amount ?? 0));
        if (!lastPaymentMap.has(p.user_id)) lastPaymentMap.set(p.user_id, p.created_at);
      }

      // Global payment stats
      const allPayments = paymentRows ?? [];
      const totalRevenue = allPayments.reduce((s, p) => s + (p.amount ?? 0), 0);
      const revenueThisMonth = allPayments
        .filter(p => p.created_at >= monthStart)
        .reduce((s, p) => s + (p.amount ?? 0), 0);
      const recentPayments = allPayments.slice(0, 20).map(p => ({
        user_id: p.user_id,
        amount: p.amount,
        currency: p.currency,
        created_at: p.created_at,
        chariow_sale_id: p.chariow_sale_id,
      }));

      const result = users.map(u => ({
        id: u.id,
        email: u.email,
        name: profileMap.get(u.id)?.name ?? '',
        plan: profileMap.get(u.id)?.plan ?? 'free',
        plan_expires_at: profileMap.get(u.id)?.plan_expires_at ?? null,
        phone: profileMap.get(u.id)?.phone ?? null,
        dial_code: profileMap.get(u.id)?.dial_code ?? null,
        country: profileMap.get(u.id)?.country ?? null,
        usage_this_month: usageMap.get(u.id) ?? 0,
        total_scripts: totalScriptsMap.get(u.id) ?? 0,
        created_at: u.created_at,
        email_confirmed: !!u.email_confirmed_at,
        payment_count: paymentCountMap.get(u.id) ?? 0,
        payment_total: paymentTotalMap.get(u.id) ?? 0,
        last_payment_at: lastPaymentMap.get(u.id) ?? null,
      }));

      const stats = {
        total: result.length,
        standard: result.filter(u => u.plan === 'standard').length,
        free: result.filter(u => u.plan === 'free').length,
        total_scripts: result.reduce((s, u) => s + u.total_scripts, 0),
        total_revenue: totalRevenue,
        revenue_this_month: revenueThisMonth,
      };

      return res.status(200).json({ users: result, stats, recentPayments });
    }

    if (action === 'set-plan' && userId && plan) {
      const expiresAt = plan === 'standard'
        ? new Date(Date.now() + 30 * 86_400_000).toISOString()
        : null;
      await supabaseAdmin
        .from('profiles')
        .update({ plan, plan_expires_at: expiresAt })
        .eq('id', userId);
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete-user' && userId) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(200).json({ ok: true });
    }

    if (action === 'reset-password' && userId && password) {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Action inconnue: ${action}` });
  } catch (err) {
    console.error('[admin] handler error:', err);
    return res.status(500).json({ error: `Erreur serveur: ${String(err)}` });
  }
}
