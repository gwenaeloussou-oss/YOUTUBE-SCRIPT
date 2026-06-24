import { motion } from 'motion/react';
import {
  Youtube,
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
} from 'lucide-react';

type Props = { onStart: () => void };

const FEATURES = [
  {
    icon: <Sparkles className="w-6 h-6 text-[#FF0000]" />,
    title: 'Script 100% original',
    desc: "L'IA analyse la structure, le ton et les points forts de la vidéo source pour créer un script unique.",
  },
  {
    icon: <Languages className="w-6 h-6 text-[#FF0000]" />,
    title: 'Multi-langue & dialectes',
    desc: "Générez en Français, English, Wolof, Nouchi et bien d'autres langues africaines et mondiales.",
  },
  {
    icon: <FileText className="w-6 h-6 text-[#FF0000]" />,
    title: 'SEO & structure pro',
    desc: 'Titre accrocheur, description optimisée, hook percutant et CTA inclus automatiquement.',
  },
  {
    icon: <ImageIcon className="w-6 h-6 text-[#FF0000]" />,
    title: 'Idée de miniature',
    desc: "Recevez une suggestion visuelle et un aperçu de votre thumbnail directement dans l'outil.",
  },
];

const STEPS = [
  { num: '01', title: 'Collez un lien YouTube', desc: "Entrez l'URL d'une vidéo dont vous voulez vous inspirer." },
  { num: '02', title: 'Choisissez vos options', desc: 'Langue, modules additionnels (titre, SEO, hook, miniature).' },
  { num: '03', title: 'Générez en un clic', desc: "L'IA produit un script complet, prêt à tourner." },
];

const TESTIMONIALS = [
  { name: 'Khalil B.', role: 'Créateur 120k abonnés', text: 'Je gagne 2h par vidéo. La qualité est bluffante, surtout en darija.' },
  { name: 'Sophie M.', role: 'Coach business', text: 'Les scripts sont bien structurés et mon taux de rétention a augmenté de 30%.' },
  { name: 'Moussa D.', role: 'Youtuber Wolof', text: 'Enfin un outil qui supporte le Wolof ! C\'est un game changer pour nous.' },
];

export default function LandingPage({ onStart }: Props) {
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white font-sans overflow-x-hidden">

      {/* Nav */}
      <header className="border-b border-white/10 py-5 px-6 md:px-12 sticky top-0 z-50 bg-[#0f0f0f]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-[#FF0000] p-2 rounded-lg">
              <Youtube className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tighter">
              YouScript <span className="text-[#FF0000]">Booster</span>
            </span>
          </div>
          <button
            onClick={onStart}
            className="flex items-center gap-2 bg-[#FF0000] hover:bg-[#D90000] px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
          >
            Lancer l'outil <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-24 md:py-36 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#FF0000]/10 rounded-full blur-[120px]" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative max-w-4xl mx-auto space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#FF0000]/10 border border-[#FF0000]/20 rounded-full text-xs font-bold uppercase tracking-widest text-[#FF0000]">
            <Zap className="w-3 h-3" /> PROPULSÉ PAR EMPIRE SCALING
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tighter">
            Créez des scripts YouTube<br />
            <span className="text-[#FF0000] italic font-serif">viraux</span>, en quelques secondes.
          </h1>
          <p className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Collez un lien YouTube, choisissez votre langue et laissez l'IA générer un script professionnel, optimisé SEO, avec hook et idée de miniature.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={onStart}
              className="flex items-center gap-2 bg-[#FF0000] hover:bg-[#D90000] px-8 py-4 rounded-2xl text-base font-bold transition-all active:scale-95 shadow-[0_0_40px_rgba(255,0,0,0.3)] w-full sm:w-auto justify-center"
            >
              <Sparkles className="w-5 h-5" /> Essayer gratuitement
            </button>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs uppercase tracking-widest text-[#FF0000] font-bold">Fonctionnalités</p>
            <h2 className="text-3xl md:text-4xl font-bold">Tout ce dont un créateur a besoin</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-[#FF0000]/30 transition-all"
              >
                <div className="w-12 h-12 bg-[#FF0000]/10 rounded-2xl flex items-center justify-center">
                  {f.icon}
                </div>
                <h3 className="font-bold text-base">{f.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs uppercase tracking-widest text-[#FF0000] font-bold">Processus</p>
            <h2 className="text-3xl md:text-4xl font-bold">Simple comme bonjour</h2>
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
                  <div className="hidden md:block absolute top-6 left-full w-full h-px bg-white/10 -z-10" />
                )}
                <span className="text-5xl font-black text-[#FF0000]/20">{s.num}</span>
                <h3 className="font-bold text-lg">{s.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs uppercase tracking-widest text-[#FF0000] font-bold">Témoignages</p>
            <h2 className="text-3xl md:text-4xl font-bold">Ils l'utilisent déjà</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4"
              >
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-[#FF0000] text-[#FF0000]" />
                  ))}
                </div>
                <p className="text-white/70 text-sm leading-relaxed italic">"{t.text}"</p>
                <div>
                  <p className="font-bold text-sm">{t.name}</p>
                  <p className="text-white/40 text-xs">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs uppercase tracking-widest text-[#FF0000] font-bold">Tarifs</p>
            <h2 className="text-3xl md:text-4xl font-bold">Simple et transparent</h2>
            <p className="text-white/40 text-sm">Commencez gratuitement. Passez au Standard quand vous êtes prêt.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">

            {/* Free */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6"
            >
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-white/40">Gratuit</p>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-extrabold">0</span>
                  <span className="text-white/40 text-sm mb-2">FCFA / mois</span>
                </div>
                <p className="text-white/40 text-xs">Sans carte bancaire</p>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-3 text-white/70"><Check className="w-4 h-4 text-white/30 flex-shrink-0" /> 5 scripts par mois</li>
                <li className="flex items-center gap-3 text-white/70"><Check className="w-4 h-4 text-white/30 flex-shrink-0" /> Français uniquement</li>
                <li className="flex items-center gap-3 text-white/70"><Check className="w-4 h-4 text-white/30 flex-shrink-0" /> Vidéo, article & texte</li>
                <li className="flex items-center gap-3 text-white/30"><X className="w-4 h-4 text-red-500/40 flex-shrink-0" /> Multilingue (EN, ES, PT)</li>
                <li className="flex items-center gap-3 text-white/30"><X className="w-4 h-4 text-red-500/40 flex-shrink-0" /> Recherche web en temps réel</li>
                <li className="flex items-center gap-3 text-white/30"><X className="w-4 h-4 text-red-500/40 flex-shrink-0" /> Prompt JSON miniature</li>
              </ul>
              <button onClick={onStart} className="w-full py-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 font-semibold text-sm transition-all active:scale-[0.98]">
                Commencer gratuitement
              </button>
            </motion.div>

            {/* Standard */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="relative bg-gradient-to-br from-[#FF0000]/10 to-orange-500/5 border border-[#FF0000]/30 rounded-3xl p-8 space-y-6"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#FF0000] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                <Crown className="w-3 h-3" /> Recommandé
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-[#FF0000]">Standard</p>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-extrabold">10 000</span>
                  <span className="text-white/40 text-sm mb-2">FCFA / mois</span>
                </div>
                <p className="text-white/40 text-xs">Paiement sécurisé via Monero</p>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-3 text-white/90"><Check className="w-4 h-4 text-green-400 flex-shrink-0" /> 60 scripts par mois</li>
                <li className="flex items-center gap-3 text-white/90"><Check className="w-4 h-4 text-green-400 flex-shrink-0" /> Français, English, Español, Português</li>
                <li className="flex items-center gap-3 text-white/90"><Check className="w-4 h-4 text-green-400 flex-shrink-0" /> Vidéo, article & texte</li>
                <li className="flex items-center gap-3 text-white/90"><Check className="w-4 h-4 text-green-400 flex-shrink-0" /> Recherche web en temps réel</li>
                <li className="flex items-center gap-3 text-white/90"><Check className="w-4 h-4 text-green-400 flex-shrink-0" /> Prompt JSON miniature (IA image)</li>
                <li className="flex items-center gap-3 text-white/90"><Check className="w-4 h-4 text-green-400 flex-shrink-0" /> Tout débloqué</li>
              </ul>
              <button onClick={onStart} className="w-full py-3.5 rounded-2xl bg-[#FF0000] hover:bg-[#D90000] font-bold text-sm transition-all active:scale-[0.98] shadow-[0_0_30px_rgba(255,0,0,0.25)]">
                <span className="flex items-center justify-center gap-2"><Zap className="w-4 h-4" /> Commencer maintenant</span>
              </button>
            </motion.div>

          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter">
            Prêt à créer votre prochain succès ?
          </h2>
          <ul className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-white/60">
            {['Gratuit', 'Résultat en secondes'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#FF0000]" /> {item}
              </li>
            ))}
          </ul>
          <button
            onClick={onStart}
            className="inline-flex items-center gap-2 bg-[#FF0000] hover:bg-[#D90000] px-10 py-5 rounded-2xl text-lg font-bold transition-all active:scale-95 shadow-[0_0_60px_rgba(255,0,0,0.25)]"
          >
            <Sparkles className="w-5 h-5" /> Lancer YouScript Booster
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-6 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="bg-[#FF0000] p-1.5 rounded-lg">
            <Youtube className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tighter">YouScript <span className="text-[#FF0000]">Booster</span></span>
        </div>
        <p className="text-white/20 text-xs tracking-widest uppercase">PROPULSÉ PAR EMPIRE SCALING</p>
      </footer>
    </div>
  );
}
