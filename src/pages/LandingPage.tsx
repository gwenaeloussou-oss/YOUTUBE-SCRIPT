import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  Languages,
  FileText,
  Image as ImageIcon,
  Zap,
  ArrowRight,
  CheckCircle2,
  Star,
  Check,
  X,
  Crown,
  Users,
  Globe2,
  History,
  ShieldCheck,
  ChevronDown,
  PlayCircle,
  Youtube,
  Newspaper,
  AlignLeft,
  BadgeCheck,
} from 'lucide-react';
import TrustBadge from '../components/TrustBadge';

type Props = { onStart: () => void };

const FEATURES = [
  {
    icon: <Sparkles className="w-6 h-6 text-[#FF0000]" />,
    title: 'Script 100% original',
    desc: "L'IA analyse la structure, le ton et les points forts de la source pour créer un script unique, jamais un copier-coller.",
  },
  {
    icon: <Languages className="w-6 h-6 text-[#FF0000]" />,
    title: 'Multi-langue & dialectes',
    desc: "Générez en Français, English, Español, Português et bien d'autres langues africaines et mondiales.",
  },
  {
    icon: <FileText className="w-6 h-6 text-[#FF0000]" />,
    title: 'SEO & structure pro',
    desc: 'Titre accrocheur, description optimisée, hook percutant et CTA inclus automatiquement dans chaque script.',
  },
  {
    icon: <ImageIcon className="w-6 h-6 text-[#FF0000]" />,
    title: 'Idée de miniature',
    desc: "Recevez une suggestion visuelle et un prompt JSON prêt pour Midjourney, DALL·E ou Flux.",
  },
  {
    icon: <Globe2 className="w-6 h-6 text-[#FF0000]" />,
    title: 'Recherche web en temps réel',
    desc: "Enrichissez vos scripts avec des données et faits actuels directement récupérés du web.",
  },
  {
    icon: <History className="w-6 h-6 text-[#FF0000]" />,
    title: 'Historique sauvegardé',
    desc: "Retrouvez, modifiez et réutilisez vos 30 dernières générations à tout moment.",
  },
];

const SOURCES = [
  { icon: <Youtube className="w-5 h-5" />, label: 'Vidéo YouTube', desc: 'Collez un lien, on extrait la transcription' },
  { icon: <Newspaper className="w-5 h-5" />, label: 'Article web', desc: 'Blog, presse, Medium, Substack...' },
  { icon: <AlignLeft className="w-5 h-5" />, label: 'Texte libre', desc: 'Notes, script existant, transcription' },
];

const STEPS = [
  { num: '01', title: 'Choisissez votre source', desc: "Lien YouTube, article web ou texte brut — à vous de choisir." },
  { num: '02', title: 'Réglez vos options', desc: 'Langue, longueur, recherche web, modules additionnels.' },
  { num: '03', title: 'Générez en un clic', desc: "L'IA produit un script complet, structuré et prêt à tourner." },
];

const STATS = [
  { value: '12 000+', label: 'Scripts générés' },
  { value: '40+', label: 'Pays actifs' },
  { value: '4,9/5', label: 'Satisfaction moyenne' },
  { value: '5', label: 'Langues disponibles' },
];

const TESTIMONIALS = [
  { name: 'Aminata Koné', role: 'Créatrice lifestyle, 85k abonnés', country: "Côte d'Ivoire 🇨🇮", text: 'Je gagne facilement 2h par vidéo. La qualité est bluffante et le ton reste toujours naturel.' },
  { name: 'Sophie Martin', role: 'Coach business', country: 'France 🇫🇷', text: 'Les scripts sont bien structurés et mon taux de rétention a augmenté de 30% en un mois.' },
  { name: 'Moussa Traoré', role: 'Youtuber tech, 120k abonnés', country: 'Mali 🇲🇱', text: "Enfin un outil qui comprend le contexte africain. C'est devenu indispensable dans mon workflow." },
  { name: 'Kwame Mensah', role: 'Créateur de contenu business', country: 'Ghana 🇬🇭', text: "L'option recherche web change tout : mes scripts contiennent des faits vérifiés et actuels." },
  { name: 'Laura Fischer', role: 'Formatrice en ligne', country: 'Allemagne 🇩🇪', text: 'Interface simple, résultats professionnels. Le prompt de miniature généré est un vrai gain de temps.' },
  { name: 'Chidinma Eze', role: 'Vlogueuse, 60k abonnés', country: 'Nigéria 🇳🇬', text: "Le hook généré capte l'attention dès les 3 premières secondes. Mes vues ont clairement progressé." },
];

const FAQS = [
  { q: 'Ai-je besoin d\'une carte bancaire pour essayer ?', a: 'Non. Le plan Gratuit vous donne 5 scripts par mois sans aucune carte bancaire. Vous passez au Standard uniquement quand vous êtes prêt.' },
  { q: 'Quelles langues sont supportées ?', a: 'Le plan Gratuit génère en Français. Le plan Standard débloque aussi English, Español et Português, avec d\'autres langues à venir.' },
  { q: 'Le contenu généré est-il vraiment original ?', a: 'Oui. L\'IA n\'effectue jamais de copier-coller : elle analyse la structure et les idées de la source pour rédiger un script entièrement nouveau, dans votre style.' },
  { q: 'Comment fonctionne le paiement ?', a: 'Le paiement est sécurisé et l\'accès au plan Standard est immédiat après confirmation. Vous pouvez annuler ou rétrograder à tout moment.' },
  { q: 'Puis-je utiliser un article ou un texte au lieu d\'une vidéo ?', a: 'Absolument. En plus des liens YouTube, vous pouvez générer un script à partir d\'un article web ou d\'un texte libre (notes, transcription, script existant).' },
  { q: 'Mes générations sont-elles sauvegardées ?', a: 'Oui, vos 30 dernières générations sont conservées dans votre historique et accessibles à tout moment depuis votre tableau de bord.' },
];

export default function LandingPage({ onStart }: Props) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans overflow-x-hidden">
      <TrustBadge />

      {/* Nav */}
      <header className="border-b border-gray-100 py-5 px-6 md:px-12 sticky top-0 z-50 bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="https://images.chariowcdn.com/cdn-cgi/image/format=auto,onerror=redirect,quality=medium-high,slow-connection-quality=50/https://assets.chariowcdn.com/assets/store_udv1gsypk62r/OAcPlra4gZkj4g0IwsDyTNxGlId1hIxTP7K8FHMl.jpg" alt="logo" className="w-12 h-12 rounded-lg object-cover" />
            <span className="text-xl font-bold tracking-tighter">
              YouScript <span className="text-[#FF0000]">Booster</span>
            </span>
          </div>
          <button
            onClick={onStart}
            className="flex items-center gap-2 bg-[#FF0000] hover:bg-[#D90000] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-lg shadow-red-500/20"
          >
            Lancer l'outil <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-24 md:py-36 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#FF0000]/[0.06] rounded-full blur-[120px]" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative max-w-4xl mx-auto space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#FF0000]/5 border border-[#FF0000]/20 rounded-full text-xs font-bold uppercase tracking-widest text-[#FF0000]">
            <Zap className="w-3 h-3" /> PROPULSÉ PAR EMPIRE SCALING
          </div>
          <h1 className="text-3xl md:text-7xl font-extrabold leading-tight tracking-tighter text-gray-900">
            Créez des scripts YouTube<br />
            <span className="text-[#FF0000] italic font-serif">viraux</span>, en quelques secondes.
          </h1>
          <p className="text-gray-500 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Collez un lien YouTube, un article, ou vos propres notes — choisissez votre langue et laissez l'IA générer un script professionnel, optimisé SEO, avec hook et idée de miniature.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={onStart}
              className="flex items-center gap-2 bg-[#FF0000] hover:bg-[#D90000] text-white px-8 py-4 rounded-2xl text-base font-bold transition-all active:scale-95 shadow-[0_0_40px_rgba(255,0,0,0.25)] w-full sm:w-auto justify-center"
            >
              <Sparkles className="w-5 h-5" /> Essayer gratuitement
            </button>
            <button
              onClick={onStart}
              className="flex items-center gap-2 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 px-8 py-4 rounded-2xl text-base font-semibold transition-all active:scale-95 w-full sm:w-auto justify-center text-gray-700"
            >
              <PlayCircle className="w-5 h-5 text-[#FF0000]" /> Voir comment ça marche
            </button>
          </div>

          {/* Inline social proof */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <div className="flex -space-x-2.5">
              {['AK', 'SM', 'KM', 'CE', 'LF'].map((initials, i) => (
                <div key={i} className="w-9 h-9 rounded-full bg-[#FF0000]/10 border-2 border-white flex items-center justify-center text-[11px] font-bold text-[#FF0000]">
                  {initials}
                </div>
              ))}
            </div>
            <div className="text-left">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-[#FF0000] text-[#FF0000]" />)}
              </div>
              <p className="text-gray-500 text-xs mt-0.5">Rejoint par 12 000+ créateurs à travers l'Afrique et l'Europe</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Stats bar */}
      <section className="py-12 px-6 border-y border-gray-100 bg-gray-50/60">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="text-center"
            >
              <p className="text-3xl md:text-4xl font-extrabold text-[#FF0000] tracking-tight">{s.value}</p>
              <p className="text-gray-500 text-xs md:text-sm mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Sources */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <p className="text-xs uppercase tracking-widest text-[#FF0000] font-bold">Sources</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Partez de ce que vous avez déjà</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Trois façons de démarrer, un seul résultat : un script prêt à tourner.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {SOURCES.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-4 bg-white border border-gray-200 rounded-2xl p-5 hover:border-[#FF0000]/30 hover:shadow-md transition-all"
              >
                <div className="w-11 h-11 bg-[#FF0000]/10 rounded-xl flex items-center justify-center text-[#FF0000] flex-shrink-0">
                  {s.icon}
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900">{s.label}</p>
                  <p className="text-gray-500 text-xs">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-gray-50/60 border-y border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs uppercase tracking-widest text-[#FF0000] font-bold">Fonctionnalités</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Tout ce dont un créateur a besoin</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-white border border-gray-200 rounded-3xl p-6 space-y-4 hover:border-[#FF0000]/30 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 bg-[#FF0000]/10 rounded-2xl flex items-center justify-center">
                  {f.icon}
                </div>
                <h3 className="font-bold text-base text-gray-900">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs uppercase tracking-widest text-[#FF0000] font-bold">Processus</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Simple comme bonjour</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative flex flex-col gap-4"
              >
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-full w-full h-px bg-gray-200 -z-10" />
                )}
                <span className="text-5xl font-black text-[#FF0000]/15">{s.num}</span>
                <h3 className="font-bold text-lg text-gray-900">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 bg-gray-50/60 border-y border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs uppercase tracking-widest text-[#FF0000] font-bold">Témoignages</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Ils l'utilisent déjà</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="bg-white border border-gray-200 rounded-3xl p-6 space-y-4 shadow-sm"
              >
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-[#FF0000] text-[#FF0000]" />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed italic">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                  <div className="w-9 h-9 rounded-full bg-[#FF0000]/10 flex items-center justify-center text-xs font-bold text-[#FF0000] flex-shrink-0">
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-gray-900 truncate">{t.name}</p>
                    <p className="text-gray-400 text-xs truncate">{t.role} · {t.country}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs uppercase tracking-widest text-[#FF0000] font-bold">Tarifs</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Simple et transparent</h2>
            <p className="text-gray-500 text-sm">Commencez gratuitement. Passez au Standard quand vous êtes prêt.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto items-start">

            {/* Free */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white border border-gray-200 rounded-3xl p-8 space-y-6"
            >
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Gratuit</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-extrabold text-gray-900 whitespace-nowrap">0</span>
                  <span className="text-gray-400 text-sm mb-1 whitespace-nowrap">FCFA / mois</span>
                </div>
                <p className="text-gray-400 text-xs">Sans carte bancaire</p>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-3 text-gray-600"><Check className="w-4 h-4 text-gray-300 flex-shrink-0" /> 5 scripts par mois</li>
                <li className="flex items-center gap-3 text-gray-600"><Check className="w-4 h-4 text-gray-300 flex-shrink-0" /> Français uniquement</li>
                <li className="flex items-center gap-3 text-gray-600"><Check className="w-4 h-4 text-gray-300 flex-shrink-0" /> Vidéo, article & texte</li>
                <li className="flex items-center gap-3 text-gray-300"><X className="w-4 h-4 text-red-300 flex-shrink-0" /> Multilingue (EN, ES, PT)</li>
                <li className="flex items-center gap-3 text-gray-300"><X className="w-4 h-4 text-red-300 flex-shrink-0" /> Recherche web en temps réel</li>
                <li className="flex items-center gap-3 text-gray-300"><X className="w-4 h-4 text-red-300 flex-shrink-0" /> Prompt JSON miniature</li>
              </ul>
              <button onClick={onStart} className="w-full py-3.5 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 font-semibold text-sm transition-all active:scale-[0.98] text-gray-700">
                Commencer gratuitement
              </button>
            </motion.div>

            {/* Standard mensuel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="relative bg-gradient-to-br from-[#FF0000]/[0.06] to-orange-500/[0.03] border border-[#FF0000]/30 rounded-3xl p-8 space-y-6"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#FF0000] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                <Crown className="w-3 h-3" /> Recommandé
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-[#FF0000]">Standard mensuel</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-extrabold text-gray-900 whitespace-nowrap">5 000</span>
                  <span className="text-gray-400 text-sm mb-1 whitespace-nowrap">FCFA / mois</span>
                </div>
                <p className="text-gray-400 text-xs">Paiement sécurisé · sans engagement</p>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-3 text-gray-800"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> 60 scripts par mois</li>
                <li className="flex items-center gap-3 text-gray-800"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Français, English, Español, Português</li>
                <li className="flex items-center gap-3 text-gray-800"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Vidéo, article & texte</li>
                <li className="flex items-center gap-3 text-gray-800"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Recherche web en temps réel</li>
                <li className="flex items-center gap-3 text-gray-800"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Prompt JSON miniature (IA image)</li>
                <li className="flex items-center gap-3 text-gray-800"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Tout débloqué</li>
              </ul>
              <button onClick={onStart} className="w-full py-3.5 rounded-2xl bg-[#FF0000] hover:bg-[#D90000] text-white font-bold text-sm transition-all active:scale-[0.98] shadow-[0_0_30px_rgba(255,0,0,0.2)]">
                <span className="flex items-center justify-center gap-2"><Zap className="w-4 h-4" /> Commencer maintenant</span>
              </button>
            </motion.div>

            {/* Standard annuel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-white border border-gray-200 rounded-3xl p-8 space-y-6"
            >
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Standard annuel</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-extrabold text-gray-900 whitespace-nowrap">60 000</span>
                  <span className="text-gray-400 text-sm mb-1 whitespace-nowrap">FCFA / an</span>
                </div>
                <p className="text-gray-400 text-xs">Soit 5 000 FCFA/mois, facturé une fois par an</p>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-3 text-gray-800"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> 60 scripts par mois</li>
                <li className="flex items-center gap-3 text-gray-800"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Français, English, Español, Português</li>
                <li className="flex items-center gap-3 text-gray-800"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Vidéo, article & texte</li>
                <li className="flex items-center gap-3 text-gray-800"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Recherche web en temps réel</li>
                <li className="flex items-center gap-3 text-gray-800"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Prompt JSON miniature (IA image)</li>
                <li className="flex items-center gap-3 text-gray-800"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Un seul paiement pour l'année</li>
              </ul>
              <button onClick={onStart} className="w-full py-3.5 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 font-semibold text-sm transition-all active:scale-[0.98] text-gray-700">
                Choisir l'annuel
              </button>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Trust / security strip */}
      <section className="py-14 px-6 border-y border-gray-100 bg-gray-50/60">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#FF0000]" />
            <p className="font-semibold text-sm text-gray-900">Paiement sécurisé</p>
            <p className="text-gray-500 text-xs">Accès immédiat après confirmation</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Users className="w-6 h-6 text-[#FF0000]" />
            <p className="font-semibold text-sm text-gray-900">Communauté active</p>
            <p className="text-gray-500 text-xs">12 000+ créateurs en Afrique et en Europe</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <BadgeCheck className="w-6 h-6 text-[#FF0000]" />
            <p className="font-semibold text-sm text-gray-900">Sans engagement</p>
            <p className="text-gray-500 text-xs">Annulez ou changez de plan à tout moment</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <p className="text-xs uppercase tracking-widest text-[#FF0000] font-bold">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Questions fréquentes</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <div key={i} className="border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-sm text-gray-900">{f.q}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-gray-500 text-sm leading-relaxed">{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-gray-900">
            Prêt à créer votre prochain succès ?
          </h2>
          <ul className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-gray-500">
            {['Gratuit', 'Résultat en secondes', 'Sans engagement'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#FF0000]" /> {item}
              </li>
            ))}
          </ul>
          <button
            onClick={onStart}
            className="inline-flex items-center gap-2 bg-[#FF0000] hover:bg-[#D90000] text-white px-10 py-5 rounded-2xl text-lg font-bold transition-all active:scale-95 shadow-[0_0_60px_rgba(255,0,0,0.2)]"
          >
            <Sparkles className="w-5 h-5" /> Lancer YouScript Booster
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 pt-14 pb-8 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 sm:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <img src="https://images.chariowcdn.com/cdn-cgi/image/format=auto,onerror=redirect,quality=medium-high,slow-connection-quality=50/https://assets.chariowcdn.com/assets/store_udv1gsypk62r/OAcPlra4gZkj4g0IwsDyTNxGlId1hIxTP7K8FHMl.jpg" alt="logo" className="w-9 h-9 rounded-md object-cover" />
              <span className="font-bold tracking-tighter text-gray-900">YouScript <span className="text-[#FF0000]">Booster</span></span>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed">Des scripts YouTube originaux, générés par IA, en quelques secondes.</p>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Produit</p>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><button onClick={onStart} className="hover:text-[#FF0000] transition-colors">Lancer l'outil</button></li>
              <li><a href="#" onClick={e => e.preventDefault()} className="hover:text-[#FF0000] transition-colors">Fonctionnalités</a></li>
              <li><a href="#" onClick={e => e.preventDefault()} className="hover:text-[#FF0000] transition-colors">Tarifs</a></li>
            </ul>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Légal</p>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#" onClick={e => e.preventDefault()} className="hover:text-[#FF0000] transition-colors">Conditions d'utilisation</a></li>
              <li><a href="#" onClick={e => e.preventDefault()} className="hover:text-[#FF0000] transition-colors">Politique de confidentialité</a></li>
            </ul>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Contact</p>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#" onClick={e => e.preventDefault()} className="hover:text-[#FF0000] transition-colors">Support</a></li>
              <li><a href="#" onClick={e => e.preventDefault()} className="hover:text-[#FF0000] transition-colors">Nous contacter</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto pt-6 border-t border-gray-100 text-center">
          <p className="text-gray-300 text-xs tracking-widest uppercase font-medium">PROPULSÉ PAR EMPIRE SCALING</p>
        </div>
      </footer>
    </div>
  );
}
