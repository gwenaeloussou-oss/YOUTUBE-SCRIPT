import { supabase } from './supabase';
import type { HistoryItem } from '../components/HistoryDrawer';

export async function getProfile(userId: string): Promise<{ plan: 'free' | 'standard'; planExpiresAt: string | null; billingCycle: 'monthly' | 'annual' }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) console.error('[db.getProfile] error:', error.code, error.message);
  if (!data) console.warn('[db.getProfile] no profile row for user:', userId);
  // Separate query: billing_cycle may not exist yet on older DBs — must not break plan/planExpiresAt above if so.
  const { data: cycleData } = await supabase.from('profiles').select('billing_cycle').eq('id', userId).maybeSingle();
  return {
    plan: (data?.plan as 'free' | 'standard') ?? 'free',
    planExpiresAt: data?.plan_expires_at ?? null,
    billingCycle: cycleData?.billing_cycle === 'annual' ? 'annual' : 'monthly',
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
    sourceType: row.source_type as 'video' | 'article' | 'text' | 'offer',
    sourceUrl: row.source_url ?? '',
    language: row.language,
    wordCount: row.word_count ?? 0,
    titre: row.titre,
    result: row.result,
    platform: row.platform ?? undefined,
    offerId: row.offer_id ?? undefined,
    objective: row.objective ?? undefined,
    status: row.status ?? undefined,
  }));
}

export async function updateContentStatus(id: string, status: 'draft' | 'validated' | 'scheduled' | 'published'): Promise<void> {
  await supabase.from('history').update({ status }).eq('id', id);
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

// ── Offres (fiche produit/service réutilisable pour la génération multi-plateforme) ──

export type Offer = {
  id: string;
  name: string;
  sector: string;
  description: string;
  target: string;
  promise: string;
  differentiators: string;
  proof: string;
  commercialTerms: string;
  cta: string;
  brandTone: string;
  language: string;
  createdAt: string;
};

type OfferRow = {
  id: string;
  name: string;
  sector: string | null;
  description: string | null;
  target: string | null;
  promise: string | null;
  differentiators: string | null;
  proof: string | null;
  commercial_terms: string | null;
  cta: string | null;
  brand_tone: string | null;
  language: string | null;
  created_at: string;
};

function mapOfferRow(row: OfferRow): Offer {
  return {
    id: row.id,
    name: row.name,
    sector: row.sector ?? '',
    description: row.description ?? '',
    target: row.target ?? '',
    promise: row.promise ?? '',
    differentiators: row.differentiators ?? '',
    proof: row.proof ?? '',
    commercialTerms: row.commercial_terms ?? '',
    cta: row.cta ?? '',
    brandTone: row.brand_tone ?? 'expert',
    language: row.language ?? 'Français',
    createdAt: row.created_at,
  };
}

export async function getOffers(userId: string): Promise<Offer[]> {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('[db.getOffers]', error.code, error.message); return []; }
  return (data ?? []).map(mapOfferRow);
}

export async function createOffer(userId: string, offer: Omit<Offer, 'id' | 'createdAt'>): Promise<Offer | null> {
  const { data, error } = await supabase
    .from('offers')
    .insert({
      user_id: userId,
      name: offer.name,
      sector: offer.sector,
      description: offer.description,
      target: offer.target,
      promise: offer.promise,
      differentiators: offer.differentiators,
      proof: offer.proof,
      commercial_terms: offer.commercialTerms,
      cta: offer.cta,
      brand_tone: offer.brandTone,
      language: offer.language,
    })
    .select()
    .single();
  if (error) { console.error('[db.createOffer]', error.code, error.message); return null; }
  return mapOfferRow(data);
}

export async function updateOffer(id: string, fields: Partial<Omit<Offer, 'id' | 'createdAt'>>): Promise<void> {
  const updates: Record<string, string> = {};
  if (fields.name !== undefined) updates.name = fields.name;
  if (fields.sector !== undefined) updates.sector = fields.sector;
  if (fields.description !== undefined) updates.description = fields.description;
  if (fields.target !== undefined) updates.target = fields.target;
  if (fields.promise !== undefined) updates.promise = fields.promise;
  if (fields.differentiators !== undefined) updates.differentiators = fields.differentiators;
  if (fields.proof !== undefined) updates.proof = fields.proof;
  if (fields.commercialTerms !== undefined) updates.commercial_terms = fields.commercialTerms;
  if (fields.cta !== undefined) updates.cta = fields.cta;
  if (fields.brandTone !== undefined) updates.brand_tone = fields.brandTone;
  if (fields.language !== undefined) updates.language = fields.language;
  if (Object.keys(updates).length === 0) return;
  await supabase.from('offers').update(updates).eq('id', id);
}

export async function deleteOffer(id: string): Promise<void> {
  await supabase.from('offers').delete().eq('id', id);
}
