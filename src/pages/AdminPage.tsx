import { useState, useEffect, useCallback } from 'react';
import {
  Users, Crown, BarChart3, Trash2, Key, ChevronLeft,
  Loader2, Check, X, AlertCircle, RefreshCw, Shield,
  TrendingUp, UserCheck, UserX,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { LoggedUser } from './AuthPage';

type AdminUser = {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'standard';
  plan_expires_at: string | null;
  usage_this_month: number;
  total_scripts: number;
  created_at: string;
  email_confirmed: boolean;
};

type Stats = {
  total: number;
  standard: number;
  free: number;
  total_scripts: number;
};

type Props = { user: LoggedUser; onBack: () => void };

async function getAdminToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? '';
}

async function adminPost(body: Record<string, unknown>) {
  const _token = await getAdminToken();
  return fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, _token }),
  });
}

export default function AdminPage({ onBack }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
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
        setError(`Erreur ${res.status}: ${detail.slice(0, 300) || 'Sans détail'}`);
        return;
      }
      const data = await res.json();
      setUsers(data.users);
      setStats(data.stats);
    } catch {
      setError('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">

      {/* Toast */}
      {actionToast && (
        <div className="fixed top-4 right-4 z-[200] flex items-center gap-2 px-4 py-3 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 text-sm font-medium backdrop-blur-sm">
          <Check className="w-4 h-4" /> {actionToast}
        </div>
      )}

      {/* Password modal */}
      {pwdModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => { setPwdModal(null); setPwdValue(''); }}>
          <div className="w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <Key className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-sm">Nouveau mot de passe</p>
                <p className="text-white/40 text-xs truncate max-w-[200px]">{pwdModal.email}</p>
              </div>
            </div>
            {pwdDone ? (
              <div className="flex items-center justify-center gap-2 py-4 text-green-400"><Check className="w-5 h-5" /> Réinitialisé !</div>
            ) : (
              <>
                <input
                  type="text"
                  value={pwdValue}
                  onChange={e => setPwdValue(e.target.value)}
                  placeholder="Nouveau mot de passe (min. 6 chars)"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-blue-500/50"
                  onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
                />
                <div className="flex gap-2">
                  <button onClick={() => { setPwdModal(null); setPwdValue(''); }} className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:text-white transition-all">Annuler</button>
                  <button onClick={handleResetPassword} disabled={pwdLoading || pwdValue.length < 6} className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
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
          <div className="w-full max-w-sm bg-[#111] border border-red-500/20 rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-sm">Supprimer le compte</p>
                <p className="text-white/40 text-xs truncate max-w-[200px]">{deleteModal.email}</p>
              </div>
            </div>
            <p className="text-white/50 text-sm">Cette action est irréversible. Toutes les données de l'utilisateur seront supprimées.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteModal(null)} className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:text-white transition-all">Annuler</button>
              <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/[0.06] px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
              <ChevronLeft className="w-4 h-4 text-white/60" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-sm">Administration</h1>
                <p className="text-white/40 text-xs">YouScript Booster</p>
              </div>
            </div>
          </div>
          <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-white/60 hover:text-white text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:block">Actualiser</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#111] border border-white/[0.07] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-white/40 text-xs font-medium uppercase tracking-widest">Utilisateurs</p>
                <Users className="w-4 h-4 text-white/20" />
              </div>
              <p className="text-3xl font-bold">{stats.total}</p>
            </div>
            <div className="bg-[#111] border border-yellow-500/20 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-yellow-500/60 text-xs font-medium uppercase tracking-widest">Standard</p>
                <Crown className="w-4 h-4 text-yellow-500/40" />
              </div>
              <p className="text-3xl font-bold text-yellow-400">{stats.standard}</p>
            </div>
            <div className="bg-[#111] border border-white/[0.07] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-white/40 text-xs font-medium uppercase tracking-widest">Gratuit</p>
                <UserX className="w-4 h-4 text-white/20" />
              </div>
              <p className="text-3xl font-bold">{stats.free}</p>
            </div>
            <div className="bg-[#111] border border-[#FF0000]/20 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[#FF0000]/60 text-xs font-medium uppercase tracking-widest">Scripts générés</p>
                <TrendingUp className="w-4 h-4 text-[#FF0000]/40" />
              </div>
              <p className="text-3xl font-bold text-[#FF0000]">{stats.total_scripts}</p>
            </div>
          </div>
        )}

        {/* Users table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-white/40" />
              <h2 className="font-semibold text-sm text-white/80">
                Utilisateurs {filtered.length !== users.length && <span className="text-white/40">({filtered.length}/{users.length})</span>}
              </h2>
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par email ou nom..."
              className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 w-full sm:w-72"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-white/30" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-white/30 text-sm">Aucun utilisateur trouvé</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.03] border-b border-white/[0.07]">
                    <th className="text-left px-5 py-3.5 text-white/40 font-medium text-xs uppercase tracking-widest">Utilisateur</th>
                    <th className="text-left px-5 py-3.5 text-white/40 font-medium text-xs uppercase tracking-widest">Plan</th>
                    <th className="text-center px-5 py-3.5 text-white/40 font-medium text-xs uppercase tracking-widest">Scripts mois</th>
                    <th className="text-center px-5 py-3.5 text-white/40 font-medium text-xs uppercase tracking-widest">Total</th>
                    <th className="text-left px-5 py-3.5 text-white/40 font-medium text-xs uppercase tracking-widest">Inscription</th>
                    <th className="text-center px-5 py-3.5 text-white/40 font-medium text-xs uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filtered.map(u => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-white/50 flex-shrink-0">
                            {(u.name || u.email).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white/90 truncate max-w-[180px]">{u.name || <span className="text-white/30 italic">Sans nom</span>}</p>
                            <div className="flex items-center gap-1.5">
                              <p className="text-white/40 text-xs truncate max-w-[180px]">{u.email}</p>
                              {!u.email_confirmed && (
                                <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/20">non vérifié</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {u.plan === 'standard' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-semibold">
                              <Crown className="w-3 h-3" /> Standard
                            </span>
                            {u.plan_expires_at && (
                              <p className="text-white/30 text-[10px] pl-1">expire {formatDate(u.plan_expires_at)}</p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs font-medium">
                            <UserX className="w-3 h-3" /> Gratuit
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`text-sm font-semibold ${u.usage_this_month > 0 ? 'text-white' : 'text-white/20'}`}>
                          {u.usage_this_month}
                        </span>
                        <span className="text-white/20 text-xs">/{u.plan === 'standard' ? '60' : '5'}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`text-sm font-semibold ${u.total_scripts > 0 ? 'text-[#FF0000]' : 'text-white/20'}`}>
                          {u.total_scripts}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-white/40 text-xs">{formatDate(u.created_at)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {planLoading === u.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                          ) : u.plan === 'standard' ? (
                            <button
                              onClick={() => setPlan(u.id, 'free')}
                              title="Passer en Gratuit"
                              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/40 hover:text-white"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setPlan(u.id, 'standard')}
                              title="Passer en Standard"
                              className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-all text-yellow-500/60 hover:text-yellow-400"
                            >
                              <Crown className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => { setPwdModal({ userId: u.id, email: u.email ?? '' }); setPwdValue(''); }}
                            title="Réinitialiser le mot de passe"
                            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-blue-500/10 hover:border-blue-500/20 transition-all text-white/40 hover:text-blue-400"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteModal({ userId: u.id, email: u.email ?? '' })}
                            title="Supprimer le compte"
                            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/20 transition-all text-white/40 hover:text-red-400"
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

        {/* Legend */}
        <div className="flex items-center gap-6 text-xs text-white/30 pb-4 flex-wrap">
          <div className="flex items-center gap-1.5"><Crown className="w-3 h-3 text-yellow-500/40" /> Passer en Standard (30 jours)</div>
          <div className="flex items-center gap-1.5"><UserX className="w-3 h-3" /> Rétrograder en Gratuit</div>
          <div className="flex items-center gap-1.5"><Key className="w-3 h-3 text-blue-400/40" /> Réinitialiser mot de passe</div>
          <div className="flex items-center gap-1.5"><Trash2 className="w-3 h-3 text-red-400/40" /> Supprimer le compte</div>
        </div>

      </main>
    </div>
  );
}
