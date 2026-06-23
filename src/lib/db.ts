import { supabase } from './supabase';
import type { HistoryItem } from '../components/HistoryDrawer';

export async function getProfile(userId: string): Promise<{ plan: 'free' | 'pro' }> {
  const { data } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();
  return { plan: (data?.plan as 'free' | 'pro') ?? 'free' };
}

export async function updatePlan(userId: string, plan: 'free' | 'pro'): Promise<void> {
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
  const { data } = await supabase
    .from('history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
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
  const { data } = await supabase
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
