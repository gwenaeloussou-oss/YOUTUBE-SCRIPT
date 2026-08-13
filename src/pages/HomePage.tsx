import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Youtube, Megaphone, Library, Crown, FileText, Layers, ArrowRight } from 'lucide-react';
import type { LoggedUser } from './AuthPage';
import type { Page } from '../components/Sidebar';
import * as db from '../lib/db';

const FREE_LIMIT = 5;
const STANDARD_LIMIT_MONTHLY = 60;
const STANDARD_LIMIT_ANNUAL = 100;

type Props = { user: LoggedUser; onNavigate: (page: Page) => void };

export default function HomePage({ user, onNavigate }: Props) {
  const [plan, setPlan] = useState<'free' | 'standard'>('free');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [monthlyUsage, setMonthlyUsage] = useState(0);
  const [totalScripts, setTotalScripts] = useState(0);
  const [offerCount, setOfferCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      db.getProfile(user.id).catch(() => ({ plan: 'free' as const, planExpiresAt: null, billingCycle: 'monthly' as const })),
      db.getMonthlyUsage(user.id).catch(() => 0),
      db.getHistory(user.id).catch(() => []),
      db.getOffers(user.id).catch(() => []),
    ]).then(([profileData, usage, history, offers]) => {
      setPlan(profileData.plan);
      setBillingCycle(profileData.billingCycle);
      setMonthlyUsage(usage);
      setTotalScripts(history.length);
      setOfferCount(offers.length);
      setLoading(false);
    });
  }, [user.id]);

  const isStandard = plan === 'standard';
  const scriptLimit = isStandard ? (billingCycle === 'annual' ? STANDARD_LIMIT_ANNUAL : STANDARD_LIMIT_MONTHLY) : FREE_LIMIT;
  const remaining = Math.max(0, scriptLimit - monthlyUsage);
  const firstName = user.name.split(' ')[0] || user.name;

  const quickSteps = [
    { num: '01', title: 'Créez votre première offre', desc: 'Décrivez votre produit ou service pour générer du contenu multi-plateforme.', action: () => onNavigate('content'), icon: <Megaphone className="w-4 h-4" /> },
    { num: '02', title: 'Générez un script vidéo', desc: 'Collez un lien YouTube, un article ou un texte pour un script prêt à tourner.', action: () => onNavigate('app'), icon: <Youtube className="w-4 h-4" /> },
    { num: '03', title: 'Explorez la bibliothèque', desc: 'Retrouvez tous vos contenus générés, filtrables par plateforme et statut.', action: () => onNavigate('content'), icon: <Library className="w-4 h-4" /> },
    { num: '04', title: 'Passez au Standard', desc: 'Débloquez plus de scripts, le multilingue et la recherche web.', action: () => onNavigate('app'), icon: <Crown className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 space-y-10">

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 space-y-4">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900">
            Bonjour {firstName},<br />
            <span className="text-[#FF0000]">que créons-nous aujourd'hui ?</span>
          </h1>
          <p className="text-gray-500 text-base max-w-lg">
            Générez des scripts vidéo et du contenu multi-plateforme avec l'IA. Choisissez un outil ci-dessous pour commencer.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button onClick={() => onNavigate('app')} className="flex items-center justify-center gap-2 bg-[#FF0000] hover:bg-[#D90000] text-white px-6 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-red-500/20">
              <Sparkles className="w-4 h-4" /> Générer un script YouTube
            </button>
            <button onClick={() => onNavigate('content')} className="flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 px-6 py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 text-gray-700">
              <Megaphone className="w-4 h-4" /> Contenu multi-plateforme
            </button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-6 text-white space-y-4">
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Quota du mois</p>
          <p className="text-4xl font-extrabold">{loading ? '—' : remaining}</p>
          <p className="text-white/50 text-xs">script{remaining > 1 ? 's' : ''} restant{remaining > 1 ? 's' : ''} sur {scriptLimit}</p>
          <div className="w-full bg-white/10 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full transition-all ${monthlyUsage >= scriptLimit ? 'bg-red-500' : 'bg-[#FF0000]'}`} style={{ width: `${loading ? 0 : Math.min(100, (monthlyUsage / scriptLimit) * 100)}%` }} />
          </div>
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-white/40">Plan</span>
            <span className={`font-bold px-2 py-0.5 rounded-full ${isStandard ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-white/60'}`}>
              {isStandard ? `Standard · ${billingCycle === 'annual' ? 'Annuel' : 'Mensuel'}` : 'Gratuit'}
            </span>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Scripts ce mois', value: monthlyUsage, icon: <FileText className="w-4 h-4 text-[#FF0000]" /> },
          { label: 'Total générés', value: totalScripts, icon: <Layers className="w-4 h-4 text-[#FF0000]" /> },
          { label: 'Offres créées', value: offerCount, icon: <Megaphone className="w-4 h-4 text-[#FF0000]" /> },
          { label: 'Quota mensuel', value: scriptLimit, icon: <Crown className="w-4 h-4 text-[#FF0000]" /> },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">{stat.label}</span>
              {stat.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{loading ? '—' : stat.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Commencez en 4 étapes</h2>
          <p className="text-gray-400 text-sm">Réglez ces points pour libérer votre flux créatif.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickSteps.map((step, i) => (
            <motion.button
              key={i}
              onClick={step.action}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="text-left bg-white border border-gray-200 rounded-2xl p-5 space-y-3 hover:border-[#FF0000]/30 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-[#FF0000]/15">{step.num}</span>
                <div className="w-8 h-8 rounded-xl bg-[#FF0000]/10 flex items-center justify-center text-[#FF0000]">{step.icon}</div>
              </div>
              <p className="font-bold text-sm text-gray-900">{step.title}</p>
              <p className="text-gray-500 text-xs leading-relaxed">{step.desc}</p>
              <span className="flex items-center gap-1 text-xs font-semibold text-[#FF0000]">Commencer <ArrowRight className="w-3 h-3" /></span>
            </motion.button>
          ))}
        </div>
      </div>

    </div>
  );
}
