import { supabase } from './supabase';
import type { HistoryItem } from '../components/HistoryDrawer';

export async function getProfile(userId: string): Promise<{ plan: 'free' | 'standard'; planExpiresAt: string | null }> {
  const { data } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', userId)
    .single();
  return {
    plan: (data?.plan as 'free' | 'standard') ?? 'free',
    planExpiresAt: data?.plan_expires_at ?? null,
  };
}

export async function updatePlan(userId: string, plan: 'free' | 'standard'): Promise<void> {
  await supabase.from('profiles').update({ plan }).eq('id', userId);
}

export async function getMonthlyUsage(userId: string): Promise<number> {
  const d = new Date();
  const { data } = await supabase
    .from('usage')
    .select('count')
    .eq('user_id', userId)
    .eq('year', d.getFullYear())
    .eq('month', d.getMonth())
    .maybeSingle();
  return data?.count ?? 0;
}

export async function incrementUsage(userId: string): Promise<number> {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  const current = await getMonthlyUsage(userId);
  const next = current + 1;
  if (current === 0) {
    await supabase.from('usage').insert({ user_id: userId, year, month, count: next });
  } else {
    await supabase
      .from('usage')
      .update({ count: next })
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month);
  }
  return next;
}

export async function getHistory(userId: string): Promise<HistoryItem[]> {
  const { data, error } = await supabase
    .from('history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) console.error('[db.getHistory]', error.code, error.message);
  return (data ?? []).map(row => ({
    id: row.id,
    date: row.created_at,
    sourceType: row.source_type as 'video' | 'article' | 'text',
    sourceUrl: row.source_url ?? '',
    language: row.language,
    wordCount: row.word_count ?? 0,
    titre: row.titre,
    result: row.result,
  }));
}

export async function addHistory(userId: string, item: {
  sourceType: string;
  sourceUrl?: string;
  language: string;
  wordCount: number;
  titre: string;
  result: object;
}): Promise<HistoryItem | null> {
  const { data, error } = await supabase
    .from('history')
    .insert({
      user_id: userId,
      source_type: item.sourceType,
      source_url: item.sourceUrl,
      language: item.language,
      word_count: item.wordCount,
      titre: item.titre,
      result: item.result,
    })
    .select()
    .single();
  if (error) console.error('[db.addHistory]', error.code, error.message);
  if (!data) return null;
  return {
    id: data.id,
    date: data.created_at,
    sourceType: data.source_type as 'video' | 'article' | 'text',
    sourceUrl: data.source_url ?? '',
    language: data.language,
    wordCount: data.word_count ?? 0,
    titre: data.titre,
    result: data.result,
  };
}

export async function deleteHistoryItem(id: string): Promise<void> {
  await supabase.from('history').delete().eq('id', id);
}

export async function clearHistory(userId: string): Promise<void> {
  await supabase.from('history').delete().eq('user_id', userId);
}

export async function updateProfile(userId: string, fields: { name?: string; phone?: string; avatar_url?: string }): Promise<void> {
  const updates: Record<string, string> = {};
  if (fields.name !== undefined) updates.name = fields.name;
  if (fields.phone !== undefined) updates.phone = fields.phone;
  if (fields.avatar_url !== undefined) updates.avatar_url = fields.avatar_url;
  if (Object.keys(updates).length > 0) {
    await supabase.from('profiles').update(updates).eq('id', userId);
  }
  // Only store name in Auth metadata — never avatar (base64 would bloat the JWT to 600KB+)
  if (fields.name !== undefined) {
    await supabase.auth.updateUser({ data: { name: fields.name } });
  }
}

export async function getFullProfile(userId: string): Promise<{ name: string; phone: string; avatar_url: string; email: string }> {
  const [{ data: profile }, { data: { user } }] = await Promise.all([
    supabase.from('profiles').select('name, phone, avatar_url').eq('id', userId).single(),
    supabase.auth.getUser(),
  ]);
  return {
    name: profile?.name ?? '',
    phone: profile?.phone ?? '',
    avatar_url: profile?.avatar_url ?? '',
    email: user?.email ?? '',
  };
}
