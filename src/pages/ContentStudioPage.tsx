import { useState, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Pencil, Trash2, Sparkles, Loader2, AlertCircle,
  Youtube, Facebook, Linkedin, Clapperboard, Check, Copy, ChevronDown,
  Library, Megaphone, Lock, X, Filter, MessageCircle,
} from 'lucide-react';
import type { LoggedUser } from './AuthPage';
import * as db from '../lib/db';
import type { Offer } from '../lib/db';
import type { HistoryItem, PlatformId, ContentStatus } from '../components/HistoryDrawer';

const FREE_LIMIT = 5;
const STANDARD_LIMIT_MONTHLY = 60;
const STANDARD_LIMIT_ANNUAL = 100;

type Objective = 'notoriete' | 'engagement' | 'conversion' | 'education';
type Tab = 'offers' | 'generate' | 'library';
type Variant = Record<string, unknown>;
type GenerateResults = Partial<Record<PlatformId, Variant[] | { error: string }>>;

const PLATFORM_META: Record<PlatformId, { label: string; icon: ReactNode; color: string }> = {
  youtube_long: { label: 'YouTube (long)', icon: <Youtube className="w-4 h-4" />, color: 'text-[#FF0000]' },
  youtube_short: { label: 'Short / Reels / TikTok', icon: <Clapperboard className="w-4 h-4" />, color: 'text-purple-600' },
  facebook: { label: 'Facebook', icon: <Facebook className="w-4 h-4" />, color: 'text-blue-600' },
  linkedin: { label: 'LinkedIn', icon: <Linkedin className="w-4 h-4" />, color: 'text-sky-700' },
  facebook_comment: { label: 'Commentaire Facebook', icon: <MessageCircle className="w-4 h-4" />, color: 'text-indigo-600' },
};

// Post Multiplateforme ne génère que des posts — les scripts vidéo restent dans l'outil Script YouTube dédié.
const GENERATABLE_PLATFORMS: PlatformId[] = ['facebook', 'linkedin', 'facebook_comment'];

const OBJECTIVE_LABELS: Record<Objective, string> = {
  notoriete: 'Notoriété',
  engagement: 'Engagement',
  conversion: 'Conversion',
  education: 'Éducation',
};

const STATUS_LABELS: Record<ContentStatus, string> = {
  draft: 'Brouillon',
  validated: 'Validé',
  scheduled: 'Planifié',
  published: 'Publié',
};

const STATUS_STYLES: Record<ContentStatus, string> = {
  draft: 'bg-gray-100 text-gray-500',
  validated: 'bg-blue-50 text-blue-700 border border-blue-200',
  scheduled: 'bg-orange-50 text-orange-700 border border-orange-200',
  published: 'bg-green-50 text-green-700 border border-green-200',
};

const LANGUAGES = ['Français', 'English', 'Español', 'Português'];
const BRAND_TONES = ['expert', 'amical', 'provocateur', 'premium'];

const EMPTY_OFFER_FORM = {
  name: '', sector: '', description: '', target: '', promise: '',
  differentiators: '', proof: '', commercialTerms: '', cta: '', brandTone: 'expert', language: 'Français',
};

type Props = { user: LoggedUser };

export default function ContentStudioPage({ user }: Props) {
  const [tab, setTab] = useState<Tab>('offers');
  const [plan, setPlan] = useState<'free' | 'standard'>('free');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [monthlyUsage, setMonthlyUsage] = useState(0);
  const [planLoading, setPlanLoading] = useState(true);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [offerForm, setOfferForm] = useState(EMPTY_OFFER_FORM);
  const [offerSaving, setOfferSaving] = useState(false);
  const [offerFormError, setOfferFormError] = useState<string | null>(null);
  const [deleteOfferId, setDeleteOfferId] = useState<string | null>(null);

  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>(['facebook']);
  const [objective, setObjective] = useState<Objective>('conversion');
  const [variantCount, setVariantCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [results, setResults] = useState<GenerateResults | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [library, setLibrary] = useState<HistoryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState<PlatformId | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ContentStatus | 'all'>('all');
  const [openLibraryItem, setOpenLibraryItem] = useState<HistoryItem | null>(null);

  const isStandard = plan === 'standard';
  const scriptLimit = isStandard ? (billingCycle === 'annual' ? STANDARD_LIMIT_ANNUAL : STANDARD_LIMIT_MONTHLY) : FREE_LIMIT;
  const remaining = Math.max(0, scriptLimit - monthlyUsage);

  useEffect(() => {
    db.getProfile(user.id).then(p => {
      setPlan(p.plan);
      setBillingCycle(p.billingCycle);
      setPlanLoading(false);
    }).catch(() => setPlanLoading(false));
    db.getMonthlyUsage(user.id).then(setMonthlyUsage).catch(() => {});
    loadOffers();
    loadLibrary();
  }, [user.id]);

  async function loadOffers() {
    setOffersLoading(true);
    const data = await db.getOffers(user.id);
    setOffers(data);
    if (!selectedOfferId && data.length > 0) setSelectedOfferId(data[0].id);
    setOffersLoading(false);
  }

  async function loadLibrary() {
    setLibraryLoading(true);
    const data = await db.getHistory(user.id);
    setLibrary(data);
    setLibraryLoading(false);
  }

  const openNewOfferForm = () => {
    setEditingOfferId(null);
    setOfferForm({ ...EMPTY_OFFER_FORM, language: isStandard ? EMPTY_OFFER_FORM.language : 'Français' });
    setOfferFormError(null);
    setShowOfferForm(true);
  };

  const openEditOfferForm = (offer: Offer) => {
    setEditingOfferId(offer.id);
    setOfferForm({
      name: offer.name, sector: offer.sector, description: offer.description, target: offer.target,
      promise: offer.promise, differentiators: offer.differentiators, proof: offer.proof,
      commercialTerms: offer.commercialTerms, cta: offer.cta, brandTone: offer.brandTone, language: offer.language,
    });
    setOfferFormError(null);
    setShowOfferForm(true);
  };

  const saveOffer = async () => {
    if (!offerForm.name.trim()) return;
    setOfferSaving(true);
    setOfferFormError(null);
    try {
      if (editingOfferId) {
        await db.updateOffer(editingOfferId, offerForm);
      } else {
        const created = await db.createOffer(user.id, offerForm);
        if (!created) { setOfferFormError("Impossible d'enregistrer l'offre. Réessayez dans un instant."); return; }
      }
      setShowOfferForm(false);
      await loadOffers();
    } finally {
      setOfferSaving(false);
    }
  };

  const confirmDeleteOffer = async () => {
    if (!deleteOfferId) return;
    await db.deleteOffer(deleteOfferId);
    setDeleteOfferId(null);
    if (selectedOfferId === deleteOfferId) setSelectedOfferId('');
    await loadOffers();
  };

  const togglePlatform = (p: PlatformId) => {
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const handleGenerate = async () => {
    if (!selectedOfferId || selectedPlatforms.length === 0) return;
    setGenerating(true);
    setGenerateError(null);
    setResults(null);
    try {
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          offerId: selectedOfferId,
          platforms: selectedPlatforms,
          objective,
          variantCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setGenerateError(data.error || 'Erreur lors de la génération.'); return; }
      setResults(data.results as GenerateResults);
      if (typeof data._newUsage === 'number') setMonthlyUsage(data._newUsage);
      loadLibrary();
    } catch {
      setGenerateError('Erreur réseau. Réessayez.');
    } finally {
      setGenerating(false);
    }
  };

  const copyVariant = (key: string, variant: Variant) => {
    const text = Object.entries(variant)
      .filter(([k]) => k !== 'note_visuelle')
      .map(([k, v]) => Array.isArray(v) ? `${k}: ${v.join(', ')}` : `${k}: ${v}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredLibrary = library.filter(item =>
    (filterPlatform === 'all' || item.platform === filterPlatform) &&
    (filterStatus === 'all' || item.status === filterStatus)
  );

  const selectedOffer = offers.find(o => o.id === selectedOfferId);

  return (
    <div className="text-gray-900 font-sans">
      {/* Page title bar */}
      <div className="border-b border-gray-100 py-5 px-4 md:px-12">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#FF0000]" />
            <h1 className="text-lg font-bold tracking-tight">Post Multiplateforme</h1>
          </div>
          {!planLoading && (
            <span className="text-xs text-gray-500">{monthlyUsage}/{scriptLimit} scripts ce mois</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 md:px-12 pt-8">
        <div className="flex bg-gray-100 rounded-2xl p-1 max-w-md">
          {([
            { id: 'offers' as Tab, label: 'Offres', icon: <Pencil className="w-3.5 h-3.5" /> },
            { id: 'generate' as Tab, label: 'Générer', icon: <Sparkles className="w-3.5 h-3.5" /> },
            { id: 'library' as Tab, label: 'Bibliothèque', icon: <Library className="w-3.5 h-3.5" /> },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-12 py-8">

        {/* ─────────────────────── OFFRES ─────────────────────── */}
        {tab === 'offers' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Vos offres</h2>
                <p className="text-gray-500 text-sm">Décrivez votre produit ou service une fois, réutilisez-le pour chaque génération.</p>
              </div>
              <button onClick={openNewOfferForm} className="flex items-center gap-2 bg-[#FF0000] hover:bg-[#D90000] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95">
                <Plus className="w-4 h-4" /> Nouvelle offre
              </button>
            </div>

            {offersLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
            ) : offers.length === 0 ? (
              <div className="border border-dashed border-gray-200 rounded-3xl py-16 text-center space-y-3">
                <Megaphone className="w-10 h-10 text-gray-200 mx-auto" />
                <p className="text-gray-400 text-sm">Aucune offre pour l'instant. Créez-en une pour commencer à générer du contenu.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {offers.map(offer => (
                  <div key={offer.id} className="border border-gray-200 rounded-2xl p-5 space-y-3 hover:border-gray-300 transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm">{offer.name}</h3>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openEditOfferForm(offer)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteOfferId(offer.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    {offer.sector && <p className="text-xs text-gray-400">{offer.sector}</p>}
                    {offer.promise && <p className="text-xs text-gray-600 line-clamp-2">{offer.promise}</p>}
                    <button
                      onClick={() => { setSelectedOfferId(offer.id); setTab('generate'); }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 hover:border-[#FF0000]/30 hover:bg-[#FF0000]/5 text-xs font-semibold text-gray-600 hover:text-[#FF0000] transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Générer du contenu
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────── GÉNÉRER ─────────────────────── */}
        {tab === 'generate' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <section className="space-y-6">
              {offers.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-3xl py-16 text-center space-y-3">
                  <p className="text-gray-400 text-sm">Créez d'abord une offre pour pouvoir générer du contenu.</p>
                  <button onClick={() => setTab('offers')} className="text-sm font-semibold text-[#FF0000] hover:underline">Créer une offre →</button>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <label className="text-xs uppercase tracking-widest font-semibold text-gray-400">Offre</label>
                    <select
                      value={selectedOfferId}
                      onChange={e => setSelectedOfferId(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3.5 px-4 text-sm focus:outline-none focus:border-[#FF0000] transition-all"
                    >
                      {offers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs uppercase tracking-widest font-semibold text-gray-400">Plateformes</label>
                    <div className="grid grid-cols-2 gap-2">
                      {GENERATABLE_PLATFORMS.map(p => (
                        <button
                          key={p}
                          onClick={() => togglePlatform(p)}
                          className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${selectedPlatforms.includes(p) ? 'bg-[#FF0000]/5 border-[#FF0000]/40 text-[#FF0000]' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'}`}
                        >
                          {PLATFORM_META[p].icon} {PLATFORM_META[p].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs uppercase tracking-widest font-semibold text-gray-400">Objectif</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(Object.keys(OBJECTIVE_LABELS) as Objective[]).map(o => (
                        <button
                          key={o}
                          onClick={() => setObjective(o)}
                          className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${objective === o ? 'bg-[#FF0000] border-[#FF0000] text-white' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'}`}
                        >
                          {OBJECTIVE_LABELS[o]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs uppercase tracking-widest font-semibold text-gray-400">Variantes par plateforme</label>
                      <span className="text-sm font-bold text-[#FF0000]">{variantCount}</span>
                    </div>
                    <input type="range" min={1} max={5} value={variantCount} onChange={e => setVariantCount(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none cursor-pointer" style={{ background: `linear-gradient(to right, #FF0000 0%, #FF0000 ${((variantCount - 1) / 4) * 100}%, rgba(0,0,0,0.08) ${((variantCount - 1) / 4) * 100}%, rgba(0,0,0,0.08) 100%)` }} />
                  </div>

                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500 flex items-center justify-between">
                    <span>Coût de cette génération</span>
                    <span className="font-bold text-gray-700">{selectedPlatforms.length * variantCount} script{selectedPlatforms.length * variantCount > 1 ? 's' : ''} · {remaining} restant{remaining > 1 ? 's' : ''}</span>
                  </div>

                  {generateError && (
                    <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />{generateError}
                    </div>
                  )}

                  <button
                    onClick={handleGenerate}
                    disabled={generating || selectedPlatforms.length === 0 || !selectedOfferId}
                    className="w-full bg-[#FF0000] hover:bg-[#D90000] disabled:bg-gray-100 disabled:text-gray-300 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    {generating ? <><Loader2 className="w-5 h-5 animate-spin" /> Génération en cours...</> : <><Sparkles className="w-5 h-5" /> Générer</>}
                  </button>
                </>
              )}
            </section>

            <section className="space-y-6">
              {!results && !generating && (
                <div className="h-full min-h-[300px] bg-gray-50 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-12 space-y-3">
                  <EmptyResultsIcon />
                  <p className="text-gray-400 font-medium max-w-[220px] text-sm">Vos contenus générés apparaîtront ici, groupés par plateforme.</p>
                </div>
              )}
              {generating && (
                <div className="h-full min-h-[300px] bg-gray-50 rounded-3xl border border-gray-200 flex flex-col items-center justify-center text-center p-12 space-y-4">
                  <Loader2 className="w-10 h-10 text-[#FF0000] animate-spin" />
                  <p className="text-gray-500 text-sm">Génération pour {selectedPlatforms.map(p => PLATFORM_META[p].label).join(', ')}...</p>
                </div>
              )}
              {results && !generating && (
                <div className="space-y-6">
                  {selectedPlatforms.map(p => {
                    const r = results[p];
                    if (!r) return null;
                    return (
                      <div key={p} className="space-y-3">
                        <div className={`flex items-center gap-2 text-sm font-bold ${PLATFORM_META[p].color}`}>
                          {PLATFORM_META[p].icon} {PLATFORM_META[p].label}
                        </div>
                        {'error' in r ? (
                          <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />{r.error}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {r.map((variant, i) => {
                              const key = `${p}-${i}`;
                              return (
                                <div key={key} className="border border-gray-200 rounded-2xl p-4 space-y-2">
                                  <VariantView variant={variant} />
                                  <button onClick={() => copyVariant(key, variant)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-all text-xs font-medium">
                                    {copiedKey === key ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />} {copiedKey === key ? 'Copié !' : 'Copier'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ─────────────────────── BIBLIOTHÈQUE ─────────────────────── */}
        {tab === 'library' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-gray-400 text-xs font-semibold uppercase tracking-widest"><Filter className="w-3.5 h-3.5" /> Filtres</div>
              <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value as PlatformId | 'all')} className="bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-medium focus:outline-none focus:border-[#FF0000]">
                <option value="all">Toutes les plateformes</option>
                {(Object.keys(PLATFORM_META) as PlatformId[]).map(p => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as ContentStatus | 'all')} className="bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-medium focus:outline-none focus:border-[#FF0000]">
                <option value="all">Tous les statuts</option>
                {(Object.keys(STATUS_LABELS) as ContentStatus[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>

            {libraryLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
            ) : filteredLibrary.length === 0 ? (
              <div className="border border-dashed border-gray-200 rounded-3xl py-16 text-center">
                <p className="text-gray-400 text-sm">Aucun contenu pour ces filtres.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden">
                {filteredLibrary.map(item => (
                  <button key={item.id} onClick={() => setOpenLibraryItem(item)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-all text-left">
                    <div className={`w-8 h-8 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0 ${item.platform ? PLATFORM_META[item.platform].color : 'text-[#FF0000]'}`}>
                      {item.platform ? PLATFORM_META[item.platform].icon : <Youtube className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.titre}</p>
                      <p className="text-xs text-gray-400">{new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${STATUS_STYLES[item.status ?? 'draft']}`}>
                      {STATUS_LABELS[item.status ?? 'draft']}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ─────────────────────── OFFER FORM MODAL ─────────────────────── */}
      <AnimatePresence>
        {showOfferForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowOfferForm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-white border border-gray-200 shadow-2xl rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg">{editingOfferId ? "Modifier l'offre" : 'Nouvelle offre'}</h2>
                <button onClick={() => setShowOfferForm(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-all"><X className="w-4 h-4" /></button>
              </div>

              <Field label="Nom de l'offre" value={offerForm.name} onChange={v => setOfferForm(f => ({ ...f, name: v }))} placeholder="Ex : Coaching business premium" required />
              <Field label="Secteur" value={offerForm.sector} onChange={v => setOfferForm(f => ({ ...f, sector: v }))} placeholder="Ex : Coaching, e-commerce, immobilier..." />
              <Field label="Description" value={offerForm.description} onChange={v => setOfferForm(f => ({ ...f, description: v }))} textarea placeholder="Décrivez votre produit ou service" />
              <Field label="Cible" value={offerForm.target} onChange={v => setOfferForm(f => ({ ...f, target: v }))} textarea placeholder="Persona, douleurs, désirs" />
              <Field label="Promesse principale" value={offerForm.promise} onChange={v => setOfferForm(f => ({ ...f, promise: v }))} placeholder="Le bénéfice n°1" />
              <Field label="Différenciateurs" value={offerForm.differentiators} onChange={v => setOfferForm(f => ({ ...f, differentiators: v }))} textarea placeholder="Ce qui vous rend unique" />
              <Field label="Preuve" value={offerForm.proof} onChange={v => setOfferForm(f => ({ ...f, proof: v }))} textarea placeholder="Témoignages, résultats, chiffres" />
              <Field label="Offre commerciale" value={offerForm.commercialTerms} onChange={v => setOfferForm(f => ({ ...f, commercialTerms: v }))} placeholder="Prix, garantie, bonus, urgence" />
              <Field label="Appel à l'action souhaité" value={offerForm.cta} onChange={v => setOfferForm(f => ({ ...f, cta: v }))} placeholder="RDV, achat, DM, inscription..." />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-gray-400 text-xs font-medium">Ton de marque</label>
                  <select value={offerForm.brandTone} onChange={e => setOfferForm(f => ({ ...f, brandTone: e.target.value }))} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF0000] capitalize">
                    {BRAND_TONES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-400 text-xs font-medium">Langue</label>
                  <select
                    value={offerForm.language}
                    onChange={e => isStandard ? setOfferForm(f => ({ ...f, language: e.target.value })) : undefined}
                    disabled={!isStandard}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF0000] disabled:opacity-50"
                  >
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  {!isStandard && <p className="text-[10px] text-gray-400 flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Multilingue en Standard</p>}
                </div>
              </div>

              {offerFormError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{offerFormError}
                </div>
              )}

              <button onClick={saveOffer} disabled={offerSaving || !offerForm.name.trim()} className="w-full bg-[#FF0000] hover:bg-[#D90000] disabled:bg-gray-100 disabled:text-gray-300 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                {offerSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {offerSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────────────── DELETE OFFER CONFIRM ─────────────────────── */}
      <AnimatePresence>
        {deleteOfferId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setDeleteOfferId(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()} className="w-full max-w-sm bg-white border border-gray-200 shadow-2xl rounded-3xl p-6 space-y-4">
              <h2 className="font-bold text-base">Supprimer cette offre ?</h2>
              <p className="text-gray-500 text-sm">Les contenus déjà générés à partir de cette offre resteront dans votre bibliothèque.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteOfferId(null)} className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-600 hover:text-gray-900 transition-all">Annuler</button>
                <button onClick={confirmDeleteOffer} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-semibold text-white transition-all">Supprimer</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────────────── LIBRARY ITEM MODAL ─────────────────────── */}
      <AnimatePresence>
        {openLibraryItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setOpenLibraryItem(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-white border border-gray-200 shadow-2xl rounded-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-base pr-4">{openLibraryItem.titre}</h2>
                <button onClick={() => setOpenLibraryItem(null)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-all flex-shrink-0"><X className="w-4 h-4" /></button>
              </div>
              <VariantView variant={openLibraryItem.result as Variant} />
              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                <label className="text-gray-400 text-xs font-medium">Statut</label>
                <select
                  value={openLibraryItem.status ?? 'draft'}
                  onChange={async e => {
                    const status = e.target.value as ContentStatus;
                    await db.updateContentStatus(openLibraryItem.id, status);
                    setOpenLibraryItem(o => o ? { ...o, status } : o);
                    setLibrary(prev => prev.map(i => i.id === openLibraryItem.id ? { ...i, status } : i));
                  }}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF0000]"
                >
                  {(Object.keys(STATUS_LABELS) as ContentStatus[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, textarea, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-gray-400 text-xs font-medium">{label}{required && <span className="text-[#FF0000]"> *</span>}</label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF0000] placeholder-gray-400 resize-none" />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF0000] placeholder-gray-400" />
      )}
    </div>
  );
}

function VariantView({ variant }: { variant: Variant }) {
  return (
    <div className="space-y-2.5 text-sm">
      {'titre' in variant && <p className="font-bold text-gray-900">{String(variant.titre)}</p>}
      {'angle' in variant && <p className="text-xs text-gray-400 italic">Angle : {String(variant.angle)}</p>}
      {'type' in variant && <p className="text-xs text-gray-400 italic">Type : {String(variant.type)}</p>}
      {'hook' in variant && <p className="text-gray-700 font-medium">"{String(variant.hook)}"</p>}
      {'accroche' in variant && <p className="text-gray-700 font-medium">"{String(variant.accroche)}"</p>}
      {'corps' in variant && <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{String(variant.corps)}</p>}
      {'commentaire' in variant && <p className="text-gray-700 whitespace-pre-wrap leading-relaxed bg-indigo-50 border border-indigo-100 rounded-xl p-3">{String(variant.commentaire)}</p>}
      {'explication' in variant && <p className="text-xs text-gray-400 italic">💡 {String(variant.explication)}</p>}
      {'texte_parle' in variant && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Texte parlé</p>
          <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{String(variant.texte_parle)}</p>
        </div>
      )}
      {'texte_ecran' in variant && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Texte à l'écran</p>
          <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{String(variant.texte_ecran)}</p>
        </div>
      )}
      {Array.isArray(variant.sections) && (
        <div className="space-y-2">
          {(variant.sections as Array<Record<string, unknown>>).map((s, i) => (
            <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{String(s.nom)}</p>
              <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{String(s.texte)}</p>
              {typeof s.note_visuelle === 'string' && s.note_visuelle && <p className="text-[11px] text-gray-400 italic">🎬 {s.note_visuelle}</p>}
            </div>
          ))}
        </div>
      )}
      {'cta' in variant && (
        <div className="p-3 bg-gradient-to-r from-[#FF0000]/10 to-[#FF0000]/5 rounded-xl border border-[#FF0000]/20 text-[#FF0000] font-medium">
          {String(variant.cta)}
        </div>
      )}
      {'duree_estimee' in variant && <p className="text-xs text-gray-400">Durée estimée : {String(variant.duree_estimee)}</p>}
      {'duree' in variant && <p className="text-xs text-gray-400">Durée : {String(variant.duree)}</p>}
      {Array.isArray(variant.hashtags) && (variant.hashtags as string[]).length > 0 && (
        <p className="text-xs text-sky-700">{(variant.hashtags as string[]).map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}</p>
      )}
    </div>
  );
}

function EmptyResultsIcon() {
  return (
    <div className="p-4 bg-white rounded-full border border-gray-200">
      <ChevronDown className="w-10 h-10 text-gray-200 rotate-90" />
    </div>
  );
}
