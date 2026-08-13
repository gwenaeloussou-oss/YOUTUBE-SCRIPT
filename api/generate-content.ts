import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import {
  getUserPlan, getUserBillingCycle, getMonthlyUsageServer, incrementMonthlyUsageServer, saveHistoryServer,
  FREE_LIMIT, STANDARD_LIMIT, STANDARD_LIMIT_ANNUAL,
  buildPlatformSystemPrompt, buildPlatformUserPrompt, retrieveKnowledge, PLATFORM_LABELS,
  type PlatformId, type ContentObjective, type OfferInput,
} from '../lib/server.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ALL_PLATFORMS: PlatformId[] = ['youtube_long', 'youtube_short', 'facebook', 'linkedin', 'facebook_comment'];
const ALL_OBJECTIVES: ContentObjective[] = ['notoriete', 'engagement', 'conversion', 'education'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { userId, offerId, platforms, objective, variantCount } = req.body as {
    userId?: string;
    offerId?: string;
    platforms?: string[];
    objective?: string;
    variantCount?: number;
  };

  if (!userId || !offerId) return res.status(400).json({ error: 'userId et offerId requis.' });

  const selectedPlatforms = (platforms ?? []).filter((p): p is PlatformId => ALL_PLATFORMS.includes(p as PlatformId));
  if (selectedPlatforms.length === 0) return res.status(400).json({ error: 'Sélectionnez au moins une plateforme.' });

  const selectedObjective: ContentObjective = ALL_OBJECTIVES.includes(objective as ContentObjective)
    ? (objective as ContentObjective)
    : 'conversion';
  const count = Math.min(5, Math.max(1, Number(variantCount) || 3));

  // ── FETCH THE OFFER (owned by this user only) ────────────────────────────
  const { data: offerRow, error: offerError } = await supabaseAdmin
    .from('offers')
    .select('*')
    .eq('id', offerId)
    .eq('user_id', userId)
    .single();
  if (offerError || !offerRow) return res.status(404).json({ error: 'Offre introuvable.' });

  // ── SERVER-SIDE PLAN + USAGE ENFORCEMENT — same quota pool as video scripts ──
  const plan = await getUserPlan(userId);
  const isStandard = plan === 'standard';
  const billingCycle = isStandard ? await getUserBillingCycle(userId) : 'monthly';
  const standardLimit = billingCycle === 'annual' ? STANDARD_LIMIT_ANNUAL : STANDARD_LIMIT;
  const limit = isStandard ? standardLimit : FREE_LIMIT;
  const currentUsage = await getMonthlyUsageServer(userId);
  const totalRequested = selectedPlatforms.length * count;
  if (currentUsage + totalRequested > limit) {
    return res.status(429).json({
      error: `Cette génération demande ${totalRequested} contenus, mais il ne vous reste que ${Math.max(0, limit - currentUsage)} sur votre quota mensuel.`,
      limit_exceeded: true,
      plan,
    });
  }

  const offer: OfferInput = {
    name: offerRow.name,
    sector: offerRow.sector ?? undefined,
    description: offerRow.description ?? undefined,
    target: offerRow.target ?? undefined,
    promise: offerRow.promise ?? undefined,
    differentiators: offerRow.differentiators ?? undefined,
    proof: offerRow.proof ?? undefined,
    commercialTerms: offerRow.commercial_terms ?? undefined,
    cta: offerRow.cta ?? undefined,
    brandTone: offerRow.brand_tone ?? undefined,
    language: isStandard ? (offerRow.language || 'Français') : 'Français',
  };

  // ── GENERATE PER PLATFORM ─────────────────────────────────────────────────
  const results: Record<string, unknown> = {};
  const historyItems: { id: string; date: string; platform: PlatformId; titre: string }[] = [];
  let newUsage = currentUsage;

  for (const platformEntry of selectedPlatforms) {
    try {
      // RAG retrieval (§6.2): query built from platform + objective + offer sector, as specified.
      const retrievalQuery = `${PLATFORM_LABELS[platformEntry]} ${selectedObjective} ${offer.sector ?? ''} ${offer.description ?? ''}`.trim().substring(0, 500);
      const retrievedChunks = await retrieveKnowledge(platformEntry, retrievalQuery);

      const system = buildPlatformSystemPrompt(platformEntry, offer.language, retrievedChunks);
      const userPrompt = buildPlatformUserPrompt(platformEntry, offer, selectedObjective, count);
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8096,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const content = message.content[0];
      if (content.type !== 'text') throw new Error('Unexpected response');
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      const parsed = JSON.parse(jsonMatch[0]) as { variants: Array<Record<string, unknown>> };
      results[platformEntry] = parsed.variants;

      for (const variant of parsed.variants) {
        newUsage = await incrementMonthlyUsageServer(userId);
        const titre = (variant.titre as string) ?? (variant.hook as string) ?? (variant.accroche as string) ?? (variant.commentaire as string) ?? `${PLATFORM_LABELS[platformEntry]} — ${offer.name}`;
        const item = await saveHistoryServer(userId, {
          sourceType: 'offer',
          language: offer.language,
          wordCount: 0,
          titre: String(titre).substring(0, 200),
          result: variant,
          platform: platformEntry,
          offerId,
          objective: selectedObjective,
        });
        if (item) historyItems.push({ ...item, platform: platformEntry, titre: String(titre) });
      }
    } catch (err) {
      console.error(`[generate-content] ${platformEntry} failed:`, err);
      results[platformEntry] = { error: `Erreur de génération pour ${PLATFORM_LABELS[platformEntry]}.` };
    }
  }

  res.json({ results, _newUsage: newUsage, _historyItems: historyItems });
}
