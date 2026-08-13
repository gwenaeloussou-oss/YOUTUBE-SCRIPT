import { useState, useEffect } from 'react';
import { Image as ImageIcon, Loader2, AlertCircle, Copy, Check, Braces, Lock, Crown, Youtube } from 'lucide-react';
import type { LoggedUser } from './AuthPage';
import type { Page } from '../components/Sidebar';
import * as db from '../lib/db';
import type { HistoryItem } from '../components/HistoryDrawer';

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
};

function isScriptResult(result: object): result is ScriptResult {
  return 'script_complet' in result && 'titre' in result;
}

type Props = { user: LoggedUser; onNavigate: (page: Page) => void };

export default function ThumbnailPage({ user, onNavigate }: Props) {
  const [plan, setPlan] = useState<'free' | 'standard'>('free');
  const [planLoading, setPlanLoading] = useState(true);
  const [scripts, setScripts] = useState<HistoryItem[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptJson, setPromptJson] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isStandard = plan === 'standard';

  useEffect(() => {
    db.getProfile(user.id).then(p => { setPlan(p.plan); setPlanLoading(false); }).catch(() => setPlanLoading(false));
    db.getHistory(user.id).then(items => {
      setScripts(items.filter(i => isScriptResult(i.result as object)));
      setScriptsLoading(false);
    }).catch(() => setScriptsLoading(false));
  }, [user.id]);

  const selectedItem = scripts.find(s => s.id === selectedId);

  const selectScript = (id: string) => {
    setSelectedId(id);
    setPromptJson(null);
    setError(null);
  };

  const generate = async () => {
    if (!selectedItem) return;
    const result = selectedItem.result as ScriptResult;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/generate-thumb-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre: result.titre,
          hook: result.hook,
          description: result.description,
          script_complet: result.script_complet,
          language: selectedItem.language,
          userId: user.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Erreur lors de la génération du prompt.');
        return;
      }
      setPromptJson(JSON.stringify(await res.json(), null, 2));
    } catch {
      setError('Erreur réseau. Réessayez.');
    } finally {
      setGenerating(false);
    }
  };

  const copyPrompt = () => {
    if (!promptJson) return;
    navigator.clipboard.writeText(promptJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div className="flex items-center gap-2">
        <ImageIcon className="w-5 h-5 text-[#FF0000]" />
        <div>
          <h1 className="text-lg font-bold tracking-tight">Miniature</h1>
          <p className="text-gray-400 text-xs">Choisissez un script, générez son prompt miniature JSON prêt pour l'IA image.</p>
        </div>
      </div>

      {!planLoading && !isStandard && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
          <Crown className="w-4 h-4 flex-shrink-0" />
          La génération de prompt miniature est réservée au plan Standard.
          <button onClick={() => onNavigate('app')} className="ml-auto font-semibold underline flex-shrink-0">Passer au Standard</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="space-y-3">
          <label className="text-xs uppercase tracking-widest font-semibold text-gray-400">Vos scripts</label>
          {scriptsLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
          ) : scripts.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-3xl py-16 text-center space-y-3">
              <Youtube className="w-10 h-10 text-gray-200 mx-auto" />
              <p className="text-gray-400 text-sm">Aucun script pour l'instant.</p>
              <button onClick={() => onNavigate('app')} className="text-sm font-semibold text-[#FF0000] hover:underline">Générer un script →</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden max-h-[520px] overflow-y-auto">
              {scripts.map(item => (
                <button
                  key={item.id}
                  onClick={() => selectScript(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${selectedId === item.id ? 'bg-[#FF0000]/5' : 'hover:bg-gray-50'}`}
                >
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 ${selectedId === item.id ? 'bg-[#FF0000]/10 border-[#FF0000]/30 text-[#FF0000]' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                    <Youtube className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.titre}</p>
                    <p className="text-xs text-gray-400">{new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} · {item.language}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          {!selectedItem ? (
            <div className="h-full min-h-[300px] bg-gray-50 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-12 space-y-3">
              <Braces className="w-10 h-10 text-gray-200" />
              <p className="text-gray-400 text-sm max-w-[220px]">Sélectionnez un script à gauche pour générer son prompt miniature.</p>
            </div>
          ) : (
            <>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl">
                <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">Script sélectionné</p>
                <p className="text-sm font-semibold text-gray-900">{selectedItem.titre}</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}

              {!isStandard ? (
                <button onClick={() => onNavigate('app')} className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border border-gray-200 bg-gray-50 text-gray-400 text-sm">
                  <Lock className="w-4 h-4" /> Disponible en version Standard <Crown className="w-4 h-4 text-yellow-500" />
                </button>
              ) : !promptJson ? (
                <button onClick={generate} disabled={generating} className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-[#FF0000] hover:bg-[#D90000] disabled:bg-gray-100 disabled:text-gray-300 text-white font-bold transition-all active:scale-[0.98]">
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Braces className="w-4 h-4" />}
                  {generating ? 'Analyse du script en cours...' : 'Générer le prompt miniature'}
                </button>
              ) : (
                <div className="relative space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-widest font-bold text-gray-400">Prompt JSON</p>
                    <button onClick={copyPrompt} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-all text-xs font-medium">
                      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />} {copied ? 'Copié !' : 'Copier'}
                    </button>
                  </div>
                  <pre className="w-full bg-[#0a0a0a] border border-gray-800 rounded-2xl p-4 text-xs text-green-400/80 leading-relaxed overflow-x-auto max-h-[420px] overflow-y-auto font-mono whitespace-pre-wrap">{promptJson}</pre>
                  <p className="text-[11px] text-gray-400">Prompt structuré pour Midjourney, DALL·E, Flux... — la génération d'image directe arrive dans une prochaine mise à jour.</p>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
