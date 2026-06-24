import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Youtube, Languages, Sparkles, Copy, Download, RotateCcw, Check,
  AlertCircle, Loader2, Layout, Type, FileText, LogOut, AlignLeft,
  Newspaper, History, Braces, Globe, Lock, Crown, X, Zap,
} from 'lucide-react';
import type { LoggedUser } from './AuthPage';
import HistoryDrawer, { type HistoryItem } from '../components/HistoryDrawer';
import * as db from '../lib/db';

const FREE_LIMIT = 5;
const STANDARD_LIMIT = 60;

type ScriptResult = {
  titre: string;
  description: string;
  hook: string;
  script_complet: {
    intro: string;
    developpement: string[];
    conclusion: string;
    cta: string;
  };
  idee_miniature: {
    background: string;
    text: string;
    elements: string[];
  };
};

const LANGUAGES = [
  { id: 'Français', label: 'Français' },
  { id: 'English', label: 'English' },
  { id: 'Español', label: 'Español' },
  { id: 'Português', label: 'Português' },
];

type Props = { user: LoggedUser; onLogout: () => void };

export default function AppPage({ user, onLogout }: Props) {
  const [plan, setPlan] = useState<'free' | 'standard'>('free');
  const [monthlyUsage, setMonthlyUsage] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [sourceType, setSourceType] = useState<'video' | 'article' | 'text'>('video');
  const [url, setUrl] = useState('');
  const [articleUrl, setArticleUrl] = useState('');
  const [freeText, setFreeText] = useState('');
  const [language, setLanguage] = useState('Français');
  const [wordCount, setWordCount] = useState(500);
  const [webSearch, setWebSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);
  const [thumbPrompt, setThumbPrompt] = useState<{ loading: boolean; json: string | null; error: string | null }>({ loading: false, json: null, error: null });
  const [copiedThumbPrompt, setCopiedThumbPrompt] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'transcript' | 'writing' | null>(null);

  const isStandard = plan === 'standard';
  const scriptLimit = isStandard ? STANDARD_LIMIT : FREE_LIMIT;

  // Load profile, usage and history from Supabase on mount
  useEffect(() => {
    async function loadUserData() {
      const [profileData, usageCount, historyItems] = await Promise.all([
        db.getProfile(user.id),
        db.getMonthlyUsage(user.id),
        db.getHistory(user.id),
      ]);
      setPlan(profileData.plan);
      setMonthlyUsage(usageCount);
      setHistory(historyItems);
    }
    loadUserData();
  }, [user.id]);

  const stripMarkdownTitle = (text: string) => {
    let cleaned = text
      .replace(/^\*\*[^\n*]+\*\*\s*\n*/gm, '')
      .replace(/^#{1,4}\s+[^\n]+\n*/gm, '')
      .trim();
    const lines = cleaned.split('\n');
    if (lines.length > 1) {
      const first = lines[0].trim();
      if (first.length < 120 && !/[.!?;,]$/.test(first)) cleaned = lines.slice(1).join('\n').trim();
    }
    return cleaned;
  };

  const cleanScriptResult = (data: ScriptResult): ScriptResult => ({
    ...data,
    script_complet: {
      ...data.script_complet,
      intro: stripMarkdownTitle(data.script_complet.intro),
      developpement: data.script_complet.developpement.map(stripMarkdownTitle),
      conclusion: stripMarkdownTitle(data.script_complet.conclusion),
      cta: stripMarkdownTitle(data.script_complet.cta),
    },
  });

  const getCleanScript = () => {
    if (!result) return '';
    return [result.script_complet.intro, ...result.script_complet.developpement, result.script_complet.conclusion, result.script_complet.cta].join('\n\n');
  };

  const generateScript = async (regenerateStyle = false) => {
    if (monthlyUsage >= scriptLimit) { setShowUpgradeModal(true); return; }
    if (sourceType === 'video' && !url.includes('youtube.com') && !url.includes('youtu.be')) {
      setError('Veuillez entrer un lien YouTube valide.'); return;
    }
    if (sourceType === 'article' && !articleUrl.startsWith('http')) {
      setError("Veuillez entrer un lien valide vers un article."); return;
    }
    if (sourceType === 'text' && freeText.trim().length < 30) {
      setError('Veuillez coller au moins 30 caractères de texte.'); return;
    }

    setLoading(true);
    setError(null);

    try {
      let transcript = '';
      if (sourceType === 'video') {
        setLoadingStep('transcript');
        try {
          const r = await fetch(`/api/transcript?url=${encodeURIComponent(url)}`);
          if (r.ok) transcript = (await r.json()).transcript ?? '';
        } catch { /* continue */ }
      }

      let articleText = '';
      if (sourceType === 'article') {
        setLoadingStep('transcript');
        const r = await fetch(`/api/article?url=${encodeURIComponent(articleUrl)}`);
        if (!r.ok) throw new Error((await r.json()).error || "Impossible de lire l'article.");
        articleText = (await r.json()).text ?? '';
      }

      setLoadingStep('writing');
      const generateRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          articleText: articleText || undefined,
          freeText: sourceType === 'text' ? freeText : undefined,
          url: sourceType === 'video' ? url : articleUrl,
          language,
          wordCount,
          options: { title: true, description: true, hook: true, thumbnail: true },
          regenerateStyle,
          webSearch: isStandard && webSearch,
        }),
      });

      if (!generateRes.ok) throw new Error((await generateRes.json()).error || 'Erreur de génération');

      const data = cleanScriptResult(await generateRes.json() as ScriptResult);
      setResult(data);
      setThumbPrompt({ loading: false, json: null, error: null });

      // Increment usage in Supabase
      const newUsage = await db.incrementUsage(user.id);
      setMonthlyUsage(newUsage);

      // Save to history in Supabase
      const newItem = await db.addHistory(user.id, {
        sourceType,
        sourceUrl: sourceType === 'video' ? url : sourceType === 'article' ? articleUrl : undefined,
        language,
        wordCount,
        titre: data.titre,
        result: data,
      });
      if (newItem) setHistory(prev => [newItem, ...prev].slice(0, 30));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
      setLoadingStep(null);
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(`TITRE: ${result.titre}\n\nDESCRIPTION:\n${result.description}\n\nHOOK:\n${result.hook}\n\nSCRIPT:\n${getCleanScript()}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const copyScriptOnly = () => { navigator.clipboard.writeText(getCleanScript()); setCopiedScript(true); setTimeout(() => setCopiedScript(false), 2000); };
  const downloadTxt = () => {
    if (!result) return;
    const el = document.createElement('a');
    el.href = URL.createObjectURL(new Blob([getCleanScript()], { type: 'text/plain' }));
    el.download = `voixoff-${result.titre.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.txt`;
    document.body.appendChild(el); el.click(); document.body.removeChild(el);
  };

  const generateThumbPrompt = async () => {
    if (!result) return;
    setThumbPrompt({ loading: true, json: null, error: null });
    try {
      const res = await fetch('/api/generate-thumb-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre: result.titre, hook: result.hook, description: result.description, script_complet: result.script_complet, language }),
      });
      if (!res.ok) throw new Error('Erreur génération prompt JSON');
      setThumbPrompt({ loading: false, json: JSON.stringify(await res.json(), null, 2), error: null });
    } catch (err) {
      setThumbPrompt({ loading: false, json: null, error: err instanceof Error ? err.message : 'Erreur inconnue.' });
    }
  };

  const openUpgradeModal = () => {
    setShowUpgradeModal(true);
    setCheckoutError(null);
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      });
      const data = await res.json();
      if (!res.ok) { setCheckoutError(data.error || 'Erreur lors de la création du paiement.'); return; }
      if (data.checkout_url) window.location.href = data.checkout_url;
    } catch {
      setCheckoutError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const remainingScripts = Math.max(0, scriptLimit - monthlyUsage);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white font-sans overflow-x-hidden">

      {/* Upgrade Modal */}
      <AnimatePresence>
        {showUpgradeModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowUpgradeModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()} className="w-full max-w-md bg-[#111] border border-white/10 rounded-3xl p-8 space-y-6">

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg">Passer au Standard</h2>
                    <p className="text-white/40 text-xs">Débloquez toutes les fonctionnalités</p>
                  </div>
                </div>
                <button onClick={() => setShowUpgradeModal(false)} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all"><X className="w-4 h-4" /></button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/40">Gratuit</p>
                  <p className="text-2xl font-bold">0<span className="text-sm font-normal text-white/40"> FCFA</span></p>
                  <ul className="space-y-2 text-xs text-white/60">
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-white/30" /> 5 scripts / mois</li>
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-white/30" /> Français uniquement</li>
                    <li className="flex items-center gap-2"><X className="w-3 h-3 text-red-500/60" /> Recherche web</li>
                    <li className="flex items-center gap-2"><X className="w-3 h-3 text-red-500/60" /> Prompt JSON miniature</li>
                    <li className="flex items-center gap-2"><X className="w-3 h-3 text-red-500/60" /> Multilingue</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-[#FF0000]/10 to-orange-500/10 border border-[#FF0000]/30 rounded-2xl p-4 space-y-3 relative">
                  <div className="absolute -top-2 -right-2 bg-[#FF0000] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Recommandé</div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#FF0000]">Standard</p>
                  <p className="text-2xl font-bold">10 000<span className="text-sm font-normal text-white/40"> FCFA/mois</span></p>
                  <ul className="space-y-2 text-xs text-white/80">
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-400" /> 60 scripts / mois</li>
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-400" /> 4 langues</li>
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-400" /> Recherche web</li>
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-400" /> Prompt JSON miniature</li>
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-400" /> Tout débloqué</li>
                  </ul>
                </div>
              </div>

              {checkoutError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{checkoutError}
                </div>
              )}

              <button onClick={handleCheckout} disabled={checkoutLoading} className="w-full bg-[#FF0000] hover:bg-[#D90000] disabled:bg-white/10 disabled:text-white/20 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {checkoutLoading ? 'Redirection vers le paiement...' : 'Passer au Standard — 10 000 FCFA/mois'}
              </button>
              <p className="text-center text-white/20 text-xs">Paiement sécurisé via Monero · Accès immédiat après paiement</p>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-white/10 py-5 px-4 md:px-12 backdrop-blur-md sticky top-0 z-50 bg-[#0f0f0f]/80">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-[#FF0000] p-1.5 rounded-lg"><Youtube className="w-5 h-5 text-white" /></div>
            <h1 className="text-xl font-bold tracking-tighter">YouScript <span className="text-[#FF0000]">Booster</span></h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setHistoryOpen(true)} className="relative flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-white/60 hover:text-white">
              <History className="w-4 h-4" />
              <span className="text-sm hidden sm:block">Historique</span>
              {history.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF0000] rounded-full text-[9px] font-bold flex items-center justify-center">{history.length > 9 ? '9+' : history.length}</span>}
            </button>

            {isStandard ? (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl">
                <Crown className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs font-bold text-yellow-400">STANDARD</span>
              </div>
            ) : (
              <button onClick={openUpgradeModal} className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-white/50 hover:text-white text-xs font-semibold">
                <Crown className="w-3.5 h-3.5" />
                <span className="hidden sm:block">Standard</span>
                <span className="text-white/30 hidden sm:block">·</span>
                <span className="text-[#FF0000] hidden sm:block">{remainingScripts}/{FREE_LIMIT}</span>
              </button>
            )}

            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
              <div className="w-6 h-6 rounded-full bg-[#FF0000]/20 border border-[#FF0000]/30 flex items-center justify-center text-[10px] font-bold text-[#FF0000]">{user.name.charAt(0).toUpperCase()}</div>
              <span className="text-sm text-white/70 hidden sm:block">{user.name}</span>
            </div>
            <button onClick={onLogout} className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/20 transition-all group">
              <LogOut className="w-4 h-4 text-white/40 group-hover:text-red-400 transition-colors" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12">

        {/* Left: Form */}
        <section className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl font-light leading-tight">Créez votre prochain{' '}<span className="italic font-serif text-[#FF0000]">succès viral</span> en un clic.</h2>
            <p className="text-white/60 text-lg leading-relaxed max-w-md">L'IA analyse vos sources, structure votre contenu et optimise chaque seconde pour l'engagement.</p>
          </div>

          <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-8 backdrop-blur-sm shadow-2xl">

            {/* Usage banner */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(scriptLimit, 10) }).map((_, i) => {
                    const threshold = isStandard ? Math.floor(monthlyUsage / scriptLimit * 10) : monthlyUsage;
                    return <div key={i} className={`w-2 h-2 rounded-full ${i < threshold ? 'bg-[#FF0000]' : 'bg-white/20'}`} />;
                  })}
                </div>
                <span className="text-xs text-white/50">{monthlyUsage}/{scriptLimit} scripts ce mois</span>
              </div>
              {!isStandard && (
                <button onClick={openUpgradeModal} className="text-xs font-semibold text-[#FF0000] hover:underline flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Passer au Standard
                </button>
              )}
            </div>

            {/* Source type */}
            <div className="flex bg-[#1a1a1a] border border-white/10 rounded-2xl p-1 gap-1">
              {(['video', 'article', 'text'] as const).map(type => (
                <button key={type} onClick={() => setSourceType(type)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${sourceType === type ? 'bg-[#FF0000] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}>
                  {type === 'video' && <><Youtube className="w-4 h-4" /> Vidéo</>}
                  {type === 'article' && <><Newspaper className="w-4 h-4" /> Article</>}
                  {type === 'text' && <><AlignLeft className="w-4 h-4" /> Texte</>}
                </button>
              ))}
            </div>

            {/* Source inputs */}
            {sourceType === 'video' && (
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-widest font-semibold text-white/40 flex items-center gap-2"><Youtube className="w-3 h-3" /> URL de la vidéo source</label>
                <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-[#FF0000] transition-all hover:border-white/20 placeholder:text-white/20" />
              </div>
            )}
            {sourceType === 'article' && (
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-widest font-semibold text-white/40 flex items-center gap-2"><Newspaper className="w-3 h-3" /> Lien de l'article source</label>
                <input type="text" value={articleUrl} onChange={e => setArticleUrl(e.target.value)} placeholder="https://example.com/mon-article..." className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-[#FF0000] transition-all hover:border-white/20 placeholder:text-white/20" />
                <p className="text-xs text-white/30">Blog, presse, Medium, Substack...</p>
              </div>
            )}
            {sourceType === 'text' && (
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-widest font-semibold text-white/40 flex items-center gap-2"><AlignLeft className="w-3 h-3" /> Colle ton texte ici</label>
                <textarea value={freeText} onChange={e => setFreeText(e.target.value)} rows={8} placeholder="Colle ici un script existant, une transcription, des notes..." className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-[#FF0000] transition-all hover:border-white/20 placeholder:text-white/20 text-sm leading-relaxed resize-none" />
                <p className="text-xs text-white/30 flex justify-between"><span>Script, transcription, notes...</span><span className={freeText.length > 0 ? 'text-white/50' : ''}>{freeText.length} car.</span></p>
              </div>
            )}

            {/* Language */}
            <div className="space-y-3">
              <label className="text-xs uppercase tracking-widest font-semibold text-white/40 flex items-center gap-2"><Languages className="w-3 h-3" /> Langue du script</label>
              <div className="grid grid-cols-4 gap-2">
                {LANGUAGES.map(lang => {
                  const locked = !isStandard && lang.id !== 'Français';
                  return (
                    <button key={lang.id} onClick={() => locked ? setShowUpgradeModal(true) : setLanguage(lang.id)} className={`relative py-2 px-3 rounded-xl text-sm font-medium transition-all border ${language === lang.id && !locked ? 'bg-[#FF0000] border-[#FF0000] text-white shadow-[0_0_20px_rgba(255,0,0,0.3)]' : locked ? 'bg-white/3 border-white/5 text-white/20 cursor-pointer' : 'bg-white/5 border-white/5 hover:border-white/20 text-white/60'}`}>
                      {locked && <Lock className="absolute top-1 right-1 w-2.5 h-2.5 text-white/20" />}
                      {lang.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Word Count */}
            <div className="space-y-4">
              <label className="text-xs uppercase tracking-widest font-semibold text-white/40 flex items-center gap-2"><AlignLeft className="w-3 h-3" /> Longueur du script</label>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-white/50">Nombre de mots</span>
                  <div className="flex items-center gap-1 bg-[#FF0000]/10 border border-[#FF0000]/20 rounded-lg px-2 py-1">
                    <span className="text-[#FF0000]/60 text-xs">~</span>
                    <input type="number" min={50} max={9999} value={wordCount} onChange={e => { const v = Number(e.target.value); if (!isNaN(v) && v > 0) setWordCount(Math.min(v, 9999)); }} onBlur={e => { const v = Number(e.target.value); setWordCount(Math.max(50, Math.min(isNaN(v) ? 500 : v, 9999))); }} className="w-16 bg-transparent text-sm font-bold text-[#FF0000] tabular-nums text-right focus:outline-none" />
                    <span className="text-[#FF0000]/60 text-xs">mots</span>
                  </div>
                </div>
                <input type="range" min={50} max={9999} step={50} value={Math.min(wordCount, 9999)} onChange={e => setWordCount(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none cursor-pointer" style={{ background: `linear-gradient(to right, #FF0000 0%, #FF0000 ${((Math.min(wordCount, 9999) - 50) / (9999 - 50)) * 100}%, rgba(255,255,255,0.1) ${((Math.min(wordCount, 9999) - 50) / (9999 - 50)) * 100}%, rgba(255,255,255,0.1) 100%)` }} />
                <div className="flex justify-between text-[10px] text-white/20 font-medium uppercase tracking-widest"><span>50</span><span>2500</span><span>5000</span><span>9999</span></div>
                <div className="flex gap-2">
                  {[{ label: 'Short', words: 200 }, { label: 'Standard', words: 500 }, { label: 'Long', words: 1000 }, { label: 'Extra', words: 2000 }].map(p => (
                    <button key={p.words} onClick={() => setWordCount(p.words)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${wordCount === p.words ? 'bg-[#FF0000]/20 border-[#FF0000]/40 text-[#FF0000]' : 'bg-white/5 border-white/5 text-white/30 hover:border-white/20 hover:text-white/60'}`}>{p.label}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Web search */}
            {isStandard ? (
              <button onClick={() => setWebSearch(w => !w)} className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all ${webSearch ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60 hover:border-white/20'}`}>
                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all ${webSearch ? 'bg-blue-500' : 'border border-white/20'}`}>
                  {webSearch && <Check className="w-3 h-3 text-white" />}
                </div>
                <Globe className="w-4 h-4 flex-shrink-0" />
                <div className="text-left">
                  <span className="text-sm font-medium block">Recherche web</span>
                  <span className="text-[11px] opacity-60">Enrichit le script avec des données réelles du web</span>
                </div>
              </button>
            ) : (
              <button onClick={() => setShowUpgradeModal(true)} className="w-full flex items-center gap-3 p-4 rounded-2xl border border-white/5 bg-white/3 text-white/25 cursor-pointer hover:border-white/10 transition-all">
                <Lock className="w-4 h-4 flex-shrink-0" />
                <Globe className="w-4 h-4 flex-shrink-0" />
                <div className="text-left">
                  <span className="text-sm font-medium block">Recherche web</span>
                  <span className="text-[11px] opacity-60">Disponible en version Standard</span>
                </div>
                <Crown className="w-4 h-4 ml-auto text-yellow-500/50" />
              </button>
            )}

            {/* Submit */}
            <button onClick={() => generateScript()} disabled={loading || (sourceType === 'video' ? !url : sourceType === 'article' ? !articleUrl : freeText.trim().length < 30)} className="w-full bg-[#FF0000] hover:bg-[#D90000] disabled:bg-white/10 disabled:text-white/20 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all relative overflow-hidden group active:scale-[0.98]">
              <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 ease-in-out" />
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loading ? 'Analyse en cours...' : 'Analyser et générer'}
            </button>

            {error && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4" />{error}
              </motion.div>
            )}
          </div>
        </section>

        {/* Right: Result */}
        <section className="relative min-h-[400px]">
          <AnimatePresence mode="wait">
            {!result && !loading && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full bg-white/5 rounded-3xl border border-white/10 border-dashed flex flex-col items-center justify-center text-center p-12 space-y-4">
                <div className="p-4 bg-white/5 rounded-full"><Layout className="w-12 h-12 text-white/20" /></div>
                <p className="text-white/40 font-medium max-w-[200px]">En attente de votre premier script...</p>
              </motion.div>
            )}

            {loading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full bg-white/5 rounded-3xl border border-white/10 flex flex-col items-center justify-center text-center p-12 space-y-6">
                <div className="relative">
                  <Loader2 className="w-16 h-16 text-[#FF0000] animate-spin" />
                  <div className="absolute inset-0 blur-xl bg-[#FF0000]/20 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">{loadingStep === 'transcript' ? (sourceType === 'article' ? "Lecture de l'article..." : 'Lecture de la vidéo...') : 'Claude écrit votre script...'}</h3>
                  <p className="text-white/40 text-sm">{loadingStep === 'transcript' ? (sourceType === 'article' ? "Extraction du contenu en cours." : 'Récupération de la transcription YouTube.') : 'Claude analyse le contenu et rédige un script original.'}</p>
                </div>
              </motion.div>
            )}

            {result && !loading && (
              <motion.div key="result" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 px-3 py-1 bg-[#FF0000]/10 border border-[#FF0000]/20 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000]" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter text-[#FF0000]">Généré avec Succès</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={copyToClipboard} title="Copier tout" className="p-2 hover:bg-white/10 rounded-lg transition-all text-white/60 hover:text-white">{copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}</button>
                    <button onClick={downloadTxt} title="Télécharger .txt" className="p-2 hover:bg-white/10 rounded-lg transition-all text-white/60 hover:text-white"><Download className="w-5 h-5" /></button>
                    <button onClick={() => generateScript(true)} title="Régénérer" className="p-2 hover:bg-white/10 rounded-lg transition-all text-white/60 hover:text-white"><RotateCcw className="w-5 h-5" /></button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs uppercase tracking-widest font-bold text-[#FF0000]">Titre Accrocheur</h3>
                  <h2 className="text-3xl font-bold tracking-tight">{result.titre}</h2>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase tracking-widest font-bold text-white/40 flex items-center gap-2"><FileText className="w-3 h-3" /> Description SEO</h3>
                    <button onClick={() => { navigator.clipboard.writeText(result.description); setCopiedDesc(true); setTimeout(() => setCopiedDesc(false), 2000); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 hover:text-white transition-all text-xs font-medium">
                      {copiedDesc ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />} {copiedDesc ? 'Copié !' : 'Copier'}
                    </button>
                  </div>
                  <textarea value={result.description} onChange={e => setResult(r => r ? { ...r, description: e.target.value } : r)} rows={Math.max(6, Math.ceil(result.description.length / 80))} className="w-full bg-white/5 rounded-2xl border border-white/10 p-4 text-sm text-white/70 leading-relaxed focus:outline-none focus:border-[#FF0000]/50 transition-all resize-y" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs uppercase tracking-widest font-bold text-white/40 flex items-center gap-2"><Sparkles className="w-3 h-3" /> Le Hook (0-15s)</h3>
                  <div className="p-4 bg-gradient-to-r from-[#FF0000]/20 to-[#FF0000]/5 rounded-2xl border border-[#FF0000]/20 italic text-[#FF0000] font-medium leading-relaxed">"{result.hook}"</div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase tracking-widest font-bold text-white/40 flex items-center gap-2"><Type className="w-3 h-3" /> Script Complet</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-white/20 italic">Modifiable</span>
                      <button onClick={copyScriptOnly} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 hover:text-white transition-all text-xs font-medium">
                        {copiedScript ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />} {copiedScript ? 'Copié !' : 'Copier le script'}
                      </button>
                      <button onClick={downloadTxt} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 hover:text-white transition-all text-xs font-medium">
                        <Download className="w-3 h-3" /> .txt
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3 bg-white/3 border border-white/8 rounded-2xl p-4">
                    {[result.script_complet.intro, ...result.script_complet.developpement, result.script_complet.conclusion, result.script_complet.cta].map((section, i) => {
                      const total = 2 + result.script_complet.developpement.length;
                      const isLast = i === total - 1;
                      const onChange = (val: string) => setResult(r => {
                        if (!r) return r;
                        const s = r.script_complet;
                        if (i === 0) return { ...r, script_complet: { ...s, intro: val } };
                        if (isLast) return { ...r, script_complet: { ...s, cta: val } };
                        if (i === total - 2) return { ...r, script_complet: { ...s, conclusion: val } };
                        const dev = [...s.developpement]; dev[i - 1] = val;
                        return { ...r, script_complet: { ...s, developpement: dev } };
                      });
                      return <textarea key={i} value={section} onChange={e => onChange(e.target.value)} rows={Math.max(2, Math.ceil(section.length / 90))} className={`w-full text-sm leading-relaxed bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FF0000]/50 transition-all resize-y ${isLast ? 'text-[#FF0000] font-medium' : 'text-white/80'}`} />;
                    })}
                  </div>
                </div>

                {/* Thumbnail concept */}
                <div className="space-y-4 pt-8 border-t border-white/10">
                  <h3 className="text-xs uppercase tracking-widest font-bold text-white/40 flex items-center gap-2"><Sparkles className="w-3 h-3" /> Concept Miniature</h3>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3">
                    <p className="text-xs italic text-white/60">"{result.idee_miniature.text}"</p>
                    <ul className="space-y-1">
                      {result.idee_miniature.elements.map((el, i) => (
                        <li key={i} className="text-xs text-white/80 flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-[#FF0000]" />{el}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Prompt JSON — Pro only */}
                <div className="space-y-4 pt-8 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase tracking-widest font-bold text-white/40 flex items-center gap-2"><Braces className="w-3 h-3" /> Prompt Miniature JSON</h3>
                    {isStandard && thumbPrompt.json && (
                      <button onClick={() => { navigator.clipboard.writeText(thumbPrompt.json!); setCopiedThumbPrompt(true); setTimeout(() => setCopiedThumbPrompt(false), 2000); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 hover:text-white transition-all text-xs font-medium">
                        {copiedThumbPrompt ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />} {copiedThumbPrompt ? 'Copié !' : 'Copier le JSON'}
                      </button>
                    )}
                  </div>

                  {!isStandard ? (
                    <button onClick={() => setShowUpgradeModal(true)} className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border border-white/10 bg-white/3 text-white/30 hover:border-white/20 transition-all text-sm">
                      <Lock className="w-4 h-4" /> Disponible en version Standard <Crown className="w-4 h-4 text-yellow-500/50" />
                    </button>
                  ) : (
                    <>
                      <p className="text-xs text-white/30">Prompt structuré pour Midjourney, DALL·E, Flux...</p>
                      {!thumbPrompt.json && !thumbPrompt.loading && (
                        <button onClick={generateThumbPrompt} className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-bold transition-all active:scale-[0.98] text-sm">
                          <Braces className="w-4 h-4" /> Générer le prompt JSON miniature
                        </button>
                      )}
                      {thumbPrompt.loading && (
                        <div className="flex items-center justify-center gap-3 py-8 rounded-2xl border border-white/10 bg-white/5 text-white/40 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" /> Analyse du script en cours...
                        </div>
                      )}
                      {thumbPrompt.error && (
                        <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />{thumbPrompt.error}
                          <button onClick={generateThumbPrompt} className="ml-auto text-xs underline">Réessayer</button>
                        </div>
                      )}
                      {thumbPrompt.json && (
                        <div className="relative">
                          <pre className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 text-xs text-green-400/80 leading-relaxed overflow-x-auto max-h-96 overflow-y-auto font-mono whitespace-pre-wrap">{thumbPrompt.json}</pre>
                          <button onClick={generateThumbPrompt} className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/30 hover:text-white transition-all" title="Régénérer"><RotateCcw className="w-3 h-3" /></button>
                        </div>
                      )}
                    </>
                  )}
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <footer className="mt-20 border-t border-white/5 py-12 px-12 text-center space-y-4">
        <p className="text-white/20 text-xs tracking-widest uppercase font-medium">PROPULSÉ PAR EMPIRE SCALING</p>
        <div className="flex items-center justify-center gap-8 opacity-20 hover:opacity-40 transition-opacity">
          <Youtube className="w-5 h-5" /><div className="w-1 h-1 bg-white rounded-full" /><Sparkles className="w-5 h-5" /><div className="w-1 h-1 bg-white rounded-full" /><Languages className="w-5 h-5" />
        </div>
      </footer>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        onSelect={item => { setResult(item.result as ScriptResult); setThumbPrompt({ loading: false, json: null, error: null }); }}
        onDelete={async id => { await db.deleteHistoryItem(id); setHistory(prev => prev.filter(i => i.id !== id)); }}
        onClear={async () => { await db.clearHistory(user.id); setHistory([]); }}
      />
    </div>
  );
}
