import { useState, useEffect, useCallback } from 'react';
import {
  Users, Crown, BarChart3, Trash2, Key,
  Loader2, Check, X, AlertCircle, RefreshCw, Shield,
  TrendingUp, UserCheck, UserX, CreditCard, DollarSign,
  BookOpen, Plus, ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { LoggedUser } from './AuthPage';
import type { Page } from '../components/Sidebar';

type Ebook = {
  id: string;
  title: string;
  platform_tags: string[];
  chunk_count: number;
  created_at: string;
};

const KNOWLEDGE_PLATFORMS: { id: string; label: string }[] = [
  { id: 'youtube_long', label: 'YouTube (long)' },
  { id: 'youtube_short', label: 'Short / Reels / TikTok' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook_comment', label: 'Commentaire Facebook' },
];

type AdminUser = {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'standard';
  plan_expires_at: string | null;
  billing_cycle: 'monthly' | 'annual';
  phone: string | null;
  dial_code: string | null;
  country: string | null;
  usage_this_month: number;
  total_scripts: number;
  created_at: string;
  email_confirmed: boolean;
  payment_count: number;
  payment_total: number;
  last_payment_at: string | null;
};

type RecentPayment = {
  user_id: string | null;
  amount: number | null;
  currency: string | null;
  created_at: string;
  chariow_sale_id: string | null;
};

type Stats = {
  total: number;
  standard: number;
  free: number;
  total_scripts: number;
  total_revenue: number;
  revenue_this_month: number;
};

function formatAmount(amount: number | null, currency = 'XOF') {
  if (!amount) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

type Props = { user: LoggedUser; onNavigate: (page: Page) => void };

async function adminPost(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const _userId = session?.user?.id ?? '';
  return fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, _userId }),
  });
}

async function knowledgePost(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const _userId = session?.user?.id ?? '';
  return fetch('/api/admin-knowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, _userId }),
  });
}

export default function AdminPage({ onNavigate }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [pwdModal, setPwdModal] = useState<{ userId: string; email: string } | null>(null);
  const [pwdValue, setPwdValue] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdDone, setPwdDone] = useState(false);

  const [deleteModal, setDeleteModal] = useState<{ userId: string; email: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [planLoading, setPlanLoading] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [ebooksLoading, setEbooksLoading] = useState(true);
  const [newEbookTitle, setNewEbookTitle] = useState('');
  const [newEbookTags, setNewEbookTags] = useState<string[]>([]);
  const [newEbookContent, setNewEbookContent] = useState('');
  const [ebookSaving, setEbookSaving] = useState(false);
  const [ebookError, setEbookError] = useState<string | null>(null);
  const [deleteEbookId, setDeleteEbookId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminPost({ action: 'users' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let detail = text;
        try { detail = JSON.parse(text).error ?? text; } catch { /* */ }
        setError(`Erreur ${res.status}: ${detail.slice(0, 300) || 'Accès refusé ou erreur serveur.'}`);
        return;
      }
      const data = await res.json();
      setUsers(data.users);
      setStats(data.stats);
      setRecentPayments(data.recentPayments ?? []);
    } catch {
      setError('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEbooks = useCallback(async () => {
    setEbooksLoading(true);
    try {
      const res = await knowledgePost({ action: 'list' });
      if (res.ok) setEbooks((await res.json()).ebooks ?? []);
    } finally {
      setEbooksLoading(false);
    }
  }, []);

  useEffect(() => { load(); loadEbooks(); }, [load, loadEbooks]);

  const toggleEbookTag = (id: string) => {
    setNewEbookTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const saveEbook = async () => {
    if (!newEbookTitle.trim() || !newEbookContent.trim()) return;
    setEbookSaving(true);
    setEbookError(null);
    try {
      const res = await knowledgePost({ action: 'add', title: newEbookTitle.trim(), platformTags: newEbookTags, content: newEbookContent });
      const data = await res.json();
      if (!res.ok) { setEbookError(data.error || "Erreur lors de l'ajout."); return; }
      setNewEbookTitle('');
      setNewEbookTags([]);
      setNewEbookContent('');
      showToast(`Guide indexé — ${data.chunksIndexed} extrait${data.chunksIndexed > 1 ? 's' : ''}`);
      await loadEbooks();
    } catch {
      setEbookError('Erreur réseau.');
    } finally {
      setEbookSaving(false);
    }
  };

  const confirmDeleteEbook = async () => {
    if (!deleteEbookId) return;
    await knowledgePost({ action: 'delete', ebookId: deleteEbookId });
    setDeleteEbookId(null);
    await loadEbooks();
    showToast('Guide supprimé');
  };

  const setPlan = async (userId: string, plan: 'free' | 'standard') => {
    setPlanLoading(userId);
    const res = await adminPost({ action: 'set-plan', userId, plan });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId
        ? {
            ...u,
            plan,
            plan_expires_at: plan === 'standard'
              ? new Date(Date.now() + 30 * 86_400_000).toISOString()
              : null,
          }
        : u
      ));
      setStats(prev => prev ? {
        ...prev,
        standard: plan === 'standard' ? prev.standard + 1 : prev.standard - 1,
        free: plan === 'free' ? prev.free + 1 : prev.free - 1,
      } : prev);
      showToast(`Plan mis à jour → ${plan}`);
    }
    setPlanLoading(null);
  };

  const handleResetPassword = async () => {
    if (!pwdModal || pwdValue.length < 6) return;
    setPwdLoading(true);
    const res = await adminPost({ action: 'reset-password', userId: pwdModal.userId, password: pwdValue });
    if (res.ok) { setPwdDone(true); setTimeout(() => { setPwdModal(null); setPwdValue(''); setPwdDone(false); }, 1500); showToast('Mot de passe réinitialisé'); }
    setPwdLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleteLoading(true);
    const res = await adminPost({ action: 'delete-user', userId: deleteModal.userId });
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== deleteModal.userId));
      setStats(prev => prev ? { ...prev, total: prev.total - 1 } : prev);
      showToast('Compte supprimé');
      setDeleteModal(null);
    }
    setDeleteLoading(false);
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      (u.phone ?? '').toLowerCase().includes(q) ||
      (u.country ?? '').toLowerCase().includes(q)
    );
  });

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="text-gray-900 font-sans">

      {/* Toast */}
      {actionToast && (
        <div className="fixed top-4 right-4 z-[200] flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium backdrop-blur-sm">
          <Check className="w-4 h-4" /> {actionToast}
        </div>
      )}

      {/* Password modal */}
      {pwdModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => { setPwdModal(null); setPwdValue(''); }}>
          <div className="w-full max-w-sm bg-white border border-gray-200 shadow-2xl rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                <Key className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">Nouveau mot de passe</p>
                <p className="text-gray-400 text-xs truncate max-w-[200px]">{pwdModal.email}</p>
              </div>
            </div>
            {pwdDone ? (
              <div className="flex items-center justify-center gap-2 py-4 text-green-600"><Check className="w-5 h-5" /> Réinitialisé !</div>
            ) : (
              <>
                <input
                  type="text"
                  value={pwdValue}
                  onChange={e => setPwdValue(e.target.value)}
                  placeholder="Nouveau mot de passe (min. 6 chars)"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500/50"
                  onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
                />
                <div className="flex gap-2">
                  <button onClick={() => { setPwdModal(null); setPwdValue(''); }} className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-600 hover:text-gray-900 transition-all">Annuler</button>
                  <button onClick={handleResetPassword} disabled={pwdLoading || pwdValue.length < 6} className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-white">
                    {pwdLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setDeleteModal(null)}>
          <div className="w-full max-w-sm bg-white border border-red-200 shadow-2xl rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">Supprimer le compte</p>
                <p className="text-gray-400 text-xs truncate max-w-[200px]">{deleteModal.email}</p>
              </div>
            </div>
            <p className="text-gray-500 text-sm">Cette action est irréversible. Toutes les données de l'utilisateur seront supprimées.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteModal(null)} className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-600 hover:text-gray-900 transition-all">Annuler</button>
              <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-white">
                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete ebook confirm modal */}
      {deleteEbookId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setDeleteEbookId(null)}>
          <div className="w-full max-w-sm bg-white border border-red-200 shadow-2xl rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              <p className="font-semibold text-sm">Supprimer ce guide ?</p>
            </div>
            <p className="text-gray-500 text-sm">Tous ses extraits indexés seront retirés de la base de connaissances.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteEbookId(null)} className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-600 hover:text-gray-900 transition-all">Annuler</button>
              <button onClick={confirmDeleteEbook} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-semibold transition-all text-white">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Page title bar */}
      <div className="border-b border-gray-100 px-4 py-4">
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="flex items-center gap-1.5 text-xs">
            <button onClick={() => onNavigate('home')} className="text-gray-400 hover:text-gray-900 transition-colors">Accueil</button>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-gray-900 font-medium">Administration</span>
          </div>
          <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm">Administration</h1>
              <p className="text-gray-400 text-xs">YouScript Booster</p>
            </div>
          </div>
          <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all text-gray-600 hover:text-gray-900 text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:block">Actualiser</span>
          </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">Utilisateurs</p>
                <Users className="w-4 h-4 text-gray-300" />
              </div>
              <p className="text-3xl font-bold">{stats.total}</p>
            </div>
            <div className="bg-white border border-yellow-200 shadow-sm rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-yellow-600 text-xs font-medium uppercase tracking-widest">Standard</p>
                <Crown className="w-4 h-4 text-yellow-500" />
              </div>
              <p className="text-3xl font-bold text-yellow-600">{stats.standard}</p>
            </div>
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">Gratuit</p>
                <UserX className="w-4 h-4 text-gray-300" />
              </div>
              <p className="text-3xl font-bold">{stats.free}</p>
            </div>
            <div className="bg-white border border-red-200 shadow-sm rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[#FF0000] text-xs font-medium uppercase tracking-widest">Scripts</p>
                <TrendingUp className="w-4 h-4 text-[#FF0000]/60" />
              </div>
              <p className="text-3xl font-bold text-[#FF0000]">{stats.total_scripts}</p>
            </div>
            <div className="bg-white border border-green-200 shadow-sm rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-green-600 text-xs font-medium uppercase tracking-widest">Ce mois</p>
                <CreditCard className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-600">{formatAmount(stats.revenue_this_month)}</p>
            </div>
            <div className="bg-white border border-green-300 shadow-sm rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-green-700 text-xs font-medium uppercase tracking-widest">Total revenus</p>
                <DollarSign className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-700">{formatAmount(stats.total_revenue)}</p>
            </div>
          </div>
        )}

        {/* Users table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-sm text-gray-700">
                Utilisateurs {filtered.length !== users.length && <span className="text-gray-400">({filtered.length}/{users.length})</span>}
              </h2>
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par email ou nom..."
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-300 w-full sm:w-72"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm">Aucun utilisateur trouvé</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-5 py-3.5 text-gray-400 font-medium text-xs uppercase tracking-widest">Utilisateur</th>
                    <th className="text-left px-5 py-3.5 text-gray-400 font-medium text-xs uppercase tracking-widest">Plan</th>
                    <th className="text-center px-5 py-3.5 text-gray-400 font-medium text-xs uppercase tracking-widest">Scripts mois</th>
                    <th className="text-center px-5 py-3.5 text-gray-400 font-medium text-xs uppercase tracking-widest">Total</th>
                    <th className="text-left px-5 py-3.5 text-gray-400 font-medium text-xs uppercase tracking-widest hidden md:table-cell">Paiements</th>
                    <th className="text-left px-5 py-3.5 text-gray-400 font-medium text-xs uppercase tracking-widest hidden lg:table-cell">Inscription</th>
                    <th className="text-center px-5 py-3.5 text-gray-400 font-medium text-xs uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                            {(u.name || u.email).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-700 truncate max-w-[180px]">{u.name || <span className="text-gray-400 italic">Sans nom</span>}</p>
                            <div className="flex items-center gap-1.5">
                              <p className="text-gray-400 text-xs truncate max-w-[180px]">{u.email}</p>
                              {!u.email_confirmed && (
                                <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">non vérifié</span>
                              )}
                            </div>
                            {(u.dial_code || u.phone) && (
                              <p className="text-gray-400 text-[10px] mt-0.5">{u.dial_code ?? ''} {u.phone ?? ''}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {u.plan === 'standard' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-semibold">
                              <Crown className="w-3 h-3" /> Standard
                            </span>
                            {u.plan_expires_at && (
                              <p className="text-gray-400 text-[10px] pl-1">expire {formatDate(u.plan_expires_at)}</p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-400 text-xs font-medium">
                            <UserX className="w-3 h-3" /> Gratuit
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`text-sm font-semibold ${u.usage_this_month > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                          {u.usage_this_month}
                        </span>
                        <span className="text-gray-300 text-xs">/{u.plan === 'standard' ? (u.billing_cycle === 'annual' ? '100' : '60') : '5'}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`text-sm font-semibold ${u.total_scripts > 0 ? 'text-[#FF0000]' : 'text-gray-300'}`}>
                          {u.total_scripts}
                        </span>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        {u.payment_count > 0 ? (
                          <div>
                            <p className="text-green-600 text-xs font-semibold">{formatAmount(u.payment_total)}</p>
                            <p className="text-gray-400 text-[10px]">{u.payment_count} paiement{u.payment_count > 1 ? 's' : ''}</p>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <p className="text-gray-400 text-xs">{formatDate(u.created_at)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {planLoading === u.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          ) : u.plan === 'standard' ? (
                            <button
                              onClick={() => setPlan(u.id, 'free')}
                              title="Passer en Gratuit"
                              className="p-2 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-all text-gray-400 hover:text-gray-900"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setPlan(u.id, 'standard')}
                              title="Passer en Standard"
                              className="p-2 rounded-lg bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 transition-all text-yellow-600 hover:text-yellow-700"
                            >
                              <Crown className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => { setPwdModal({ userId: u.id, email: u.email ?? '' }); setPwdValue(''); }}
                            title="Réinitialiser le mot de passe"
                            className="p-2 rounded-lg bg-gray-50 border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-all text-gray-400 hover:text-blue-600"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteModal({ userId: u.id, email: u.email ?? '' })}
                            title="Supprimer le compte"
                            className="p-2 rounded-lg bg-gray-50 border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-all text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent payments */}
        {recentPayments.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-green-500" />
              <h2 className="font-semibold text-sm text-gray-700">Paiements récents</h2>
              <span className="text-gray-400 text-xs">({recentPayments.length})</span>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-green-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-green-50 border-b border-green-200">
                    <th className="text-left px-5 py-3 text-green-700 font-medium text-xs uppercase tracking-widest">Utilisateur</th>
                    <th className="text-left px-5 py-3 text-green-700 font-medium text-xs uppercase tracking-widest">Montant</th>
                    <th className="text-left px-5 py-3 text-green-700 font-medium text-xs uppercase tracking-widest">Date</th>
                    <th className="text-left px-5 py-3 text-green-700 font-medium text-xs uppercase tracking-widest hidden md:table-cell">ID Chariow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-100">
                  {recentPayments.map((p, i) => {
                    const u = users.find(u => u.id === p.user_id);
                    return (
                      <tr key={i} className="hover:bg-green-50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="text-gray-700 text-xs font-medium">{u?.email ?? p.user_id?.slice(0, 8) ?? '—'}</p>
                          {u?.name && <p className="text-gray-400 text-[10px]">{u.name}</p>}
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-green-600 font-semibold text-sm">{formatAmount(p.amount, p.currency ?? 'XOF')}</span>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-gray-400 text-xs">{formatDate(p.created_at)}</p>
                        </td>
                        <td className="px-5 py-3 hidden md:table-cell">
                          <p className="text-gray-300 text-[10px] font-mono">{p.chariow_sale_id ?? '—'}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Base de connaissances (RAG) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-sm text-gray-700">Base de connaissances</h2>
            <span className="text-gray-400 text-xs">— guides consultés par l'IA pour structurer les contenus générés</span>
          </div>

          <div className="border border-gray-200 rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={newEbookTitle}
                onChange={e => setNewEbookTitle(e.target.value)}
                placeholder="Titre du guide (ex : Chapitre 2 — Les commentaires)"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF0000] placeholder-gray-400"
              />
              <div className="flex flex-wrap gap-1.5 items-center">
                {KNOWLEDGE_PLATFORMS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => toggleEbookTag(p.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${newEbookTags.includes(p.id) ? 'bg-[#FF0000]/5 border-[#FF0000]/40 text-[#FF0000]' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={newEbookContent}
              onChange={e => setNewEbookContent(e.target.value)}
              placeholder="Collez ici le texte extrait du guide/ebook (PDF, Markdown...). Il sera découpé en extraits et indexé automatiquement."
              rows={6}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF0000] placeholder-gray-400 resize-y"
            />
            {ebookError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{ebookError}
              </div>
            )}
            <button
              onClick={saveEbook}
              disabled={ebookSaving || !newEbookTitle.trim() || !newEbookContent.trim()}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#FF0000] hover:bg-[#D90000] disabled:bg-gray-100 disabled:text-gray-300 text-white rounded-xl text-sm font-semibold transition-all active:scale-95"
            >
              {ebookSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {ebookSaving ? 'Indexation en cours...' : 'Ajouter et indexer'}
            </button>
          </div>

          {ebooksLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
          ) : ebooks.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Aucun guide indexé — la génération utilise les frameworks par défaut en attendant.</p>
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden">
              {ebooks.map(e => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <BookOpen className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{e.title}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      {e.platform_tags.length === 0 ? (
                        <span className="text-[10px] text-gray-400">Toutes plateformes</span>
                      ) : e.platform_tags.map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-500">
                          {KNOWLEDGE_PLATFORMS.find(p => p.id === t)?.label ?? t}
                        </span>
                      ))}
                      <span className="text-[10px] text-gray-300">· {e.chunk_count} extrait{e.chunk_count > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <button onClick={() => setDeleteEbookId(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 text-xs text-gray-400 pb-4 flex-wrap">
          <div className="flex items-center gap-1.5"><Crown className="w-3 h-3 text-yellow-500" /> Passer en Standard (30 jours)</div>
          <div className="flex items-center gap-1.5"><UserX className="w-3 h-3" /> Rétrograder en Gratuit</div>
          <div className="flex items-center gap-1.5"><Key className="w-3 h-3 text-blue-500" /> Réinitialiser mot de passe</div>
          <div className="flex items-center gap-1.5"><Trash2 className="w-3 h-3 text-red-500" /> Supprimer le compte</div>
        </div>

      </main>
    </div>
  );
}
