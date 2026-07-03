import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BadgeCheck, X } from 'lucide-react';

type Signup = { name: string; country: string; flag: string };

const SIGNUPS: Signup[] = [
  { name: 'Aminata Koné', country: "Côte d'Ivoire", flag: '🇨🇮' },
  { name: 'Fatou Diop', country: 'Sénégal', flag: '🇸🇳' },
  { name: 'Moussa Traoré', country: 'Mali', flag: '🇲🇱' },
  { name: 'Kwame Mensah', country: 'Ghana', flag: '🇬🇭' },
  { name: 'Ngozi Okafor', country: 'Nigéria', flag: '🇳🇬' },
  { name: 'Ibrahima Sow', country: 'Guinée', flag: '🇬🇳' },
  { name: 'Aïcha Ndiaye', country: 'Sénégal', flag: '🇸🇳' },
  { name: 'Sékou Camara', country: "Côte d'Ivoire", flag: '🇨🇮' },
  { name: 'Chidinma Eze', country: 'Nigéria', flag: '🇳🇬' },
  { name: 'Kofi Boateng', country: 'Ghana', flag: '🇬🇭' },
  { name: 'Adama Diallo', country: 'Burkina Faso', flag: '🇧🇫' },
  { name: 'Fatoumata Camara', country: 'Guinée', flag: '🇬🇳' },
  { name: 'Grace Adeyemi', country: 'Nigéria', flag: '🇳🇬' },
  { name: 'Salif Keita', country: 'Mali', flag: '🇲🇱' },
  { name: 'Awa Konaté', country: "Côte d'Ivoire", flag: '🇨🇮' },
  { name: 'Mariam Cissé', country: 'Mali', flag: '🇲🇱' },
  { name: 'Yves Kouassi', country: "Côte d'Ivoire", flag: '🇨🇮' },
  { name: 'Zainab Bello', country: 'Nigéria', flag: '🇳🇬' },
  { name: 'Patrice Ngoma', country: 'Congo (RDC)', flag: '🇨🇩' },
  { name: 'Jean-Marc Mbeki', country: 'Cameroun', flag: '🇨🇲' },
  { name: 'Aminata Sy', country: 'Sénégal', flag: '🇸🇳' },
  { name: 'Emeka Obi', country: 'Nigéria', flag: '🇳🇬' },
  { name: 'Rokia Bamba', country: 'Mali', flag: '🇲🇱' },
  { name: 'Sophie Martin', country: 'France', flag: '🇫🇷' },
  { name: 'Lucas Bernard', country: 'France', flag: '🇫🇷' },
  { name: 'Emma Rousseau', country: 'Belgique', flag: '🇧🇪' },
  { name: 'Julien Petit', country: 'France', flag: '🇫🇷' },
  { name: 'Laura Fischer', country: 'Allemagne', flag: '🇩🇪' },
  { name: 'Marco Rossi', country: 'Italie', flag: '🇮🇹' },
  { name: 'Carla Mendes', country: 'Portugal', flag: '🇵🇹' },
  { name: 'Thomas Weber', country: 'Suisse', flag: '🇨🇭' },
  { name: 'Camille Dubois', country: 'France', flag: '🇫🇷' },
  { name: 'James Wilson', country: 'Royaume-Uni', flag: '🇬🇧' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TrustBadge() {
  const [current, setCurrent] = useState<Signup | null>(null);
  const [visible, setVisible] = useState(false);
  const queueRef = useRef<Signup[]>(shuffle(SIGNUPS));

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout>;
    let hideTimer: ReturnType<typeof setTimeout>;

    function scheduleNext(delay: number) {
      showTimer = setTimeout(() => {
        if (queueRef.current.length === 0) queueRef.current = shuffle(SIGNUPS);
        const next = queueRef.current.pop()!;
        setCurrent(next);
        setVisible(true);
        hideTimer = setTimeout(() => {
          setVisible(false);
          scheduleNext(8000 + Math.random() * 7000);
        }, 5000);
      }, delay);
    }

    scheduleNext(4000);
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-[90] pointer-events-none">
      <AnimatePresence>
        {visible && current && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-auto flex items-start gap-3 bg-white border border-gray-200 rounded-2xl shadow-xl shadow-black/10 p-4 w-[290px] max-w-[calc(100vw-2rem)]"
          >
            <div className="w-10 h-10 rounded-full bg-[#FF0000]/10 flex items-center justify-center flex-shrink-0">
              <BadgeCheck className="w-5 h-5 text-[#FF0000]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900 text-sm truncate">{current.name}</p>
              <p className="text-gray-500 text-xs leading-snug">
                Vient de s'inscrire sur <span className="font-semibold text-gray-700">YouScript Booster</span> 🎉
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-gray-400">
                <BadgeCheck className="w-3 h-3 text-[#FF0000]" />
                <span>Empire Scaling</span>
                <span>·</span>
                <span>{current.country} {current.flag}</span>
              </div>
            </div>
            <button onClick={() => setVisible(false)} className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
