import { X, Youtube, Newspaper, Clock, Trash2, ChevronRight, AlignLeft } from 'lucide-react';

export type HistoryItem = {
  id: string;
  date: string;
  sourceType: 'video' | 'article' | 'text';
  sourceUrl?: string;
  language: string;
  wordCount: number;
  titre: string;
  result: object;
};

const MAX_HISTORY = 30;

const FLAG: Record<string, string> = {
  'Français': '🇫🇷',
  'English': '🇬🇧',
  'Español': '🇪🇸',
  'Português': '🇵🇹',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  if (h < 24) return `Il y a ${h}h`;
  if (d < 7) return `Il y a ${d}j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

type Props = {
  open: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
};

export default function HistoryDrawer({ open, onClose, history, onSelect, onDelete, onClear }: Props) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />
      )}
      <div className={`fixed top-0 right-0 h-full w-full max-w-sm bg-[#111] border-l border-white/10 z-50 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="space-y-0.5">
            <h2 className="font-bold text-base">Historique</h2>
            <p className="text-white/40 text-xs">{history.length} / {MAX_HISTORY} générations</p>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button onClick={onClear} className="text-[10px] uppercase tracking-widest text-white/30 hover:text-red-400 transition-colors px-2 py-1 border border-white/10 hover:border-red-500/30 rounded-lg">
                Tout effacer
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-white/20 px-8 text-center">
              <Clock className="w-10 h-10" />
              <p className="text-sm">Aucune génération pour l'instant.<br />Vos scripts apparaîtront ici.</p>
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="group flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-all border-b border-white/5">
                <div className="mt-0.5 w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                  {item.sourceType === 'video' && <Youtube className="w-4 h-4 text-[#FF0000]" />}
                  {item.sourceType === 'article' && <Newspaper className="w-4 h-4 text-blue-400" />}
                  {item.sourceType === 'text' && <AlignLeft className="w-4 h-4 text-green-400" />}
                </div>
                <button onClick={() => { onSelect(item); onClose(); }} className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-white/90 line-clamp-2 leading-snug group-hover:text-white transition-colors">{item.titre}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-white/30">{timeAgo(item.date)}</span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span className="text-[11px] text-white/30">{FLAG[item.language] ?? ''} {item.language}</span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span className="text-[11px] text-white/30">~{item.wordCount} mots</span>
                  </div>
                </button>
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { onSelect(item); onClose(); }} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all" title="Ouvrir">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDelete(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all" title="Supprimer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {history.length > 0 && (
          <div className="px-5 py-3 border-t border-white/5">
            <p className="text-[10px] text-white/20 text-center uppercase tracking-widest">
              Les {MAX_HISTORY} dernières générations sont conservées
            </p>
          </div>
        )}
      </div>
    </>
  );
}
