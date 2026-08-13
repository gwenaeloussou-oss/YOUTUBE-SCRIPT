import { useState, useEffect, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, User, Mail, Phone, Crown, AlertCircle, Loader2, Check, ArrowRight } from 'lucide-react';
import type { LoggedUser } from '../pages/AuthPage';
import * as db from '../lib/db';
import { supabase } from '../lib/supabase';

const FREE_LIMIT = 5;
const STANDARD_LIMIT_MONTHLY = 60;
const STANDARD_LIMIT_ANNUAL = 100;

type Props = { user: LoggedUser; open: boolean; onClose: () => void; onUpgrade: () => void };

export default function ProfileModal({ user, open, onClose, onUpgrade }: Props) {
  const [profileName, setProfileName] = useState(user.name);
  const [profilePhone, setProfilePhone] = useState('');
  const [profileEmail, setProfileEmail] = useState(user.email);
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [plan, setPlan] = useState<'free' | 'standard'>('free');
  const [planExpiresAt, setPlanExpiresAt] = useState<Date | null>(null);
  const [subscriptionCycle, setSubscriptionCycle] = useState<'monthly' | 'annual'>('monthly');
  const [monthlyUsage, setMonthlyUsage] = useState(0);

  const isStandard = plan === 'standard';
  const scriptLimit = isStandard ? (subscriptionCycle === 'annual' ? STANDARD_LIMIT_ANNUAL : STANDARD_LIMIT_MONTHLY) : FREE_LIMIT;
  const now = new Date();
  const daysUntilExpiry = planExpiresAt ? Math.ceil((planExpiresAt.getTime() - now.getTime()) / 86_400_000) : null;
  const inGrace = isStandard && daysUntilExpiry !== null && daysUntilExpiry < 0;

  useEffect(() => {
    if (!open) return;
    setProfileError(null);
    setProfileSaved(false);
    db.getFullProfile(user.id)
      .then(p => {
        setProfileName(p.name || user.name);
        setProfilePhone(p.phone || '');
        setProfileEmail(p.email || user.email);
        setProfileAvatar(p.avatar_url || '');
      })
      .catch(() => {
        setProfileName(user.name);
        setProfileEmail(user.email);
      });
    db.getProfile(user.id).then(p => {
      setPlan(p.plan);
      setPlanExpiresAt(p.planExpiresAt ? new Date(p.planExpiresAt) : null);
      setSubscriptionCycle(p.billingCycle);
    }).catch(() => {});
    db.getMonthlyUsage(user.id).then(setMonthlyUsage).catch(() => {});
  }, [open, user.id, user.name, user.email]);

  const handleAvatarUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setProfileAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      await db.updateProfile(user.id, {
        name: profileName.trim(),
        phone: profilePhone.trim(),
        avatar_url: profileAvatar.trim(),
      });
      if (profileEmail.trim() !== user.email) {
        const { error } = await supabase.auth.updateUser({ email: profileEmail.trim() });
        if (error) throw new Error('Erreur changement email : ' + error.message);
      }
      setProfileSaved(true);
      setTimeout(() => { setProfileSaved(false); onClose(); }, 1500);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()} className="w-full max-w-sm bg-white border border-gray-200 shadow-2xl rounded-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base">Mon profil</h2>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-all"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex flex-col items-center gap-3">
              <label className="relative cursor-pointer group">
                {profileAvatar ? (
                  <img src={profileAvatar} alt="avatar" className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 group-hover:border-gray-300 transition-all" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-[#FF0000]/20 border-2 border-[#FF0000]/30 flex items-center justify-center text-2xl font-bold text-[#FF0000] group-hover:border-[#FF0000]/60 transition-all">
                    {(profileName || user.name).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </label>
              <p className="text-gray-400 text-xs">Cliquez pour changer la photo</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-gray-400 text-xs font-medium flex items-center gap-1.5"><User className="w-3 h-3" /> Nom complet</label>
                <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Votre nom" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-300 transition-all placeholder-gray-400" />
              </div>
              <div className="space-y-1.5">
                <label className="text-gray-400 text-xs font-medium flex items-center gap-1.5"><Mail className="w-3 h-3" /> Email</label>
                <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} placeholder="votre@email.com" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-300 transition-all placeholder-gray-400" />
                {profileEmail !== user.email && <p className="text-orange-600 text-xs pl-1">Un email de confirmation vous sera envoyé</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-gray-400 text-xs font-medium flex items-center gap-1.5"><Phone className="w-3 h-3" /> Téléphone</label>
                <input type="tel" value={profilePhone} onChange={e => setProfilePhone(e.target.value)} placeholder="+225 07 00 00 00 00" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-300 transition-all placeholder-gray-400" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs font-medium flex items-center gap-1.5"><Crown className="w-3 h-3" /> Plan actuel</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isStandard ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-gray-100 text-gray-400'}`}>
                  {isStandard ? `Standard · ${subscriptionCycle === 'annual' ? 'Annuel' : 'Mensuel'}` : 'Gratuit'}
                </span>
              </div>
              {isStandard && planExpiresAt && (
                <p className="text-xs text-gray-400">
                  Expire le <span className="text-gray-700 font-semibold">{planExpiresAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                  {inGrace && <span className="ml-2 text-red-600 font-semibold">(période de grâce)</span>}
                </p>
              )}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Scripts ce mois</span>
                  <span className="text-xs font-bold text-gray-700">{monthlyUsage} / {scriptLimit}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${monthlyUsage >= scriptLimit ? 'bg-red-500' : 'bg-[#FF0000]'}`}
                    style={{ width: `${Math.min(100, (monthlyUsage / scriptLimit) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400">{Math.max(0, scriptLimit - monthlyUsage)} script{scriptLimit - monthlyUsage > 1 ? 's' : ''} restant{scriptLimit - monthlyUsage > 1 ? 's' : ''} ce mois</p>
              </div>
              {!isStandard && (
                <button onClick={() => { onClose(); onUpgrade(); }} className="w-full text-xs text-[#FF0000] hover:underline text-left flex items-center gap-1.5 font-semibold">
                  <Crown className="w-3 h-3" /> Passer au Standard — dès 60 scripts/mois
                </button>
              )}
            </div>

            {profileError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{profileError}
              </div>
            )}

            <button onClick={handleSaveProfile} disabled={profileLoading || profileSaved} className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-gray-100 disabled:text-gray-300 py-3.5 rounded-full font-bold flex items-center justify-center gap-2 transition-all text-white shadow-lg shadow-green-500/20">
              {profileLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : profileSaved ? <Check className="w-4 h-4" /> : null}
              {profileLoading ? 'Sauvegarde...' : profileSaved ? 'Sauvegardé !' : 'Enregistrer'}
              {!profileLoading && !profileSaved && <ArrowRight className="w-4 h-4" />}
            </button>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
