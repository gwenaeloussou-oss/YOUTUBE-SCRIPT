import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Youtube, Mail, Lock, User, Phone, ArrowLeft, Eye, EyeOff, AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';

type AuthMode = 'login' | 'signup';

type Country = { name: string; code: string; dial: string; flag: string };

const COUNTRIES: Country[] = [
  { name: 'Afghanistan', code: 'AF', dial: '+93', flag: '🇦🇫' },
  { name: 'Afrique du Sud', code: 'ZA', dial: '+27', flag: '🇿🇦' },
  { name: 'Albanie', code: 'AL', dial: '+355', flag: '🇦🇱' },
  { name: 'Algérie', code: 'DZ', dial: '+213', flag: '🇩🇿' },
  { name: 'Allemagne', code: 'DE', dial: '+49', flag: '🇩🇪' },
  { name: 'Arabie Saoudite', code: 'SA', dial: '+966', flag: '🇸🇦' },
  { name: 'Argentine', code: 'AR', dial: '+54', flag: '🇦🇷' },
  { name: 'Australie', code: 'AU', dial: '+61', flag: '🇦🇺' },
  { name: 'Autriche', code: 'AT', dial: '+43', flag: '🇦🇹' },
  { name: 'Belgique', code: 'BE', dial: '+32', flag: '🇧🇪' },
  { name: 'Bénin', code: 'BJ', dial: '+229', flag: '🇧🇯' },
  { name: 'Brésil', code: 'BR', dial: '+55', flag: '🇧🇷' },
  { name: 'Burkina Faso', code: 'BF', dial: '+226', flag: '🇧🇫' },
  { name: 'Cameroun', code: 'CM', dial: '+237', flag: '🇨🇲' },
  { name: 'Canada', code: 'CA', dial: '+1', flag: '🇨🇦' },
  { name: 'Chine', code: 'CN', dial: '+86', flag: '🇨🇳' },
  { name: "Côte d'Ivoire", code: 'CI', dial: '+225', flag: '🇨🇮' },
  { name: 'Congo (RDC)', code: 'CD', dial: '+243', flag: '🇨🇩' },
  { name: 'Congo (Brazzaville)', code: 'CG', dial: '+242', flag: '🇨🇬' },
  { name: 'Danemark', code: 'DK', dial: '+45', flag: '🇩🇰' },
  { name: 'Égypte', code: 'EG', dial: '+20', flag: '🇪🇬' },
  { name: 'Émirats Arabes Unis', code: 'AE', dial: '+971', flag: '🇦🇪' },
  { name: 'Espagne', code: 'ES', dial: '+34', flag: '🇪🇸' },
  { name: 'États-Unis', code: 'US', dial: '+1', flag: '🇺🇸' },
  { name: 'Éthiopie', code: 'ET', dial: '+251', flag: '🇪🇹' },
  { name: 'France', code: 'FR', dial: '+33', flag: '🇫🇷' },
  { name: 'Gabon', code: 'GA', dial: '+241', flag: '🇬🇦' },
  { name: 'Ghana', code: 'GH', dial: '+233', flag: '🇬🇭' },
  { name: 'Grèce', code: 'GR', dial: '+30', flag: '🇬🇷' },
  { name: 'Guinée', code: 'GN', dial: '+224', flag: '🇬🇳' },
  { name: 'Inde', code: 'IN', dial: '+91', flag: '🇮🇳' },
  { name: 'Indonésie', code: 'ID', dial: '+62', flag: '🇮🇩' },
  { name: 'Irak', code: 'IQ', dial: '+964', flag: '🇮🇶' },
  { name: 'Iran', code: 'IR', dial: '+98', flag: '🇮🇷' },
  { name: 'Irlande', code: 'IE', dial: '+353', flag: '🇮🇪' },
  { name: 'Israël', code: 'IL', dial: '+972', flag: '🇮🇱' },
  { name: 'Italie', code: 'IT', dial: '+39', flag: '🇮🇹' },
  { name: 'Japon', code: 'JP', dial: '+81', flag: '🇯🇵' },
  { name: 'Kenya', code: 'KE', dial: '+254', flag: '🇰🇪' },
  { name: 'Liban', code: 'LB', dial: '+961', flag: '🇱🇧' },
  { name: 'Madagascar', code: 'MG', dial: '+261', flag: '🇲🇬' },
  { name: 'Mali', code: 'ML', dial: '+223', flag: '🇲🇱' },
  { name: 'Maroc', code: 'MA', dial: '+212', flag: '🇲🇦' },
  { name: 'Mauritanie', code: 'MR', dial: '+222', flag: '🇲🇷' },
  { name: 'Mexique', code: 'MX', dial: '+52', flag: '🇲🇽' },
  { name: 'Niger', code: 'NE', dial: '+227', flag: '🇳🇪' },
  { name: 'Nigéria', code: 'NG', dial: '+234', flag: '🇳🇬' },
  { name: 'Norvège', code: 'NO', dial: '+47', flag: '🇳🇴' },
  { name: 'Pakistan', code: 'PK', dial: '+92', flag: '🇵🇰' },
  { name: 'Pays-Bas', code: 'NL', dial: '+31', flag: '🇳🇱' },
  { name: 'Philippines', code: 'PH', dial: '+63', flag: '🇵🇭' },
  { name: 'Pologne', code: 'PL', dial: '+48', flag: '🇵🇱' },
  { name: 'Portugal', code: 'PT', dial: '+351', flag: '🇵🇹' },
  { name: 'République Tchèque', code: 'CZ', dial: '+420', flag: '🇨🇿' },
  { name: 'Roumanie', code: 'RO', dial: '+40', flag: '🇷🇴' },
  { name: 'Royaume-Uni', code: 'GB', dial: '+44', flag: '🇬🇧' },
  { name: 'Russie', code: 'RU', dial: '+7', flag: '🇷🇺' },
  { name: 'Rwanda', code: 'RW', dial: '+250', flag: '🇷🇼' },
  { name: 'Sénégal', code: 'SN', dial: '+221', flag: '🇸🇳' },
  { name: 'Singapour', code: 'SG', dial: '+65', flag: '🇸🇬' },
  { name: 'Suède', code: 'SE', dial: '+46', flag: '🇸🇪' },
  { name: 'Suisse', code: 'CH', dial: '+41', flag: '🇨🇭' },
  { name: 'Tanzanie', code: 'TZ', dial: '+255', flag: '🇹🇿' },
  { name: 'Tchad', code: 'TD', dial: '+235', flag: '🇹🇩' },
  { name: 'Togo', code: 'TG', dial: '+228', flag: '🇹🇬' },
  { name: 'Tunisie', code: 'TN', dial: '+216', flag: '🇹🇳' },
  { name: 'Turquie', code: 'TR', dial: '+90', flag: '🇹🇷' },
  { name: 'Ukraine', code: 'UA', dial: '+380', flag: '🇺🇦' },
  { name: 'Vietnam', code: 'VN', dial: '+84', flag: '🇻🇳' },
];

export type LoggedUser = { id: string; name: string; email: string };

type Props = { onBack: () => void; onAuth: (user: LoggedUser) => void };

export default function AuthPage({ onBack, onAuth }: Props) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES.find(c => c.code === 'FR')!);
  const [countrySearch, setCountrySearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setCountrySearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.dial.includes(countrySearch)
  );

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setError(null);
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setDropdownOpen(false);
    setCountrySearch('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!name.trim()) { setError('Veuillez entrer votre nom.'); return; }
        if (!/^[\d\s\-().]{5,14}$/.test(phone)) { setError('Numéro de téléphone invalide.'); return; }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name.trim(),
              phone: `${selectedCountry.dial}${phone.replace(/\s/g, '')}`,
              dial_code: selectedCountry.dial,
              country: selectedCountry.name,
            },
          },
        });

        if (signUpError) {
          if (signUpError.message.includes('already registered')) {
            setError('Un compte existe déjà avec cet email.');
          } else {
            setError(signUpError.message);
          }
          return;
        }

        if (data.user) {
          onAuth({ id: data.user.id, name: name.trim(), email });
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

        if (signInError) {
          setError('Email ou mot de passe incorrect.');
          return;
        }

        if (data.user) {
          onAuth({
            id: data.user.id,
            name: data.user.user_metadata?.name ?? email,
            email: data.user.email ?? email,
          });
        }
      }
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white font-sans flex flex-col">
      <header className="border-b border-white/10 py-5 px-6 md:px-12 bg-[#0f0f0f]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="bg-[#FF0000] p-1.5 rounded-lg">
              <Youtube className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tighter">
              YouScript <span className="text-[#FF0000]">Booster</span>
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              {mode === 'login' ? 'Bon retour 👋' : 'Créer votre compte'}
            </h1>
            <p className="text-white/50 text-sm">
              {mode === 'login' ? 'Connectez-vous pour accéder à YouScript Booster' : 'Rejoignez des milliers de créateurs'}
            </p>
          </div>

          <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1">
            <button onClick={() => switchMode('login')} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === 'login' ? 'bg-[#FF0000] text-white' : 'text-white/40 hover:text-white'}`}>
              Se connecter
            </button>
            <button onClick={() => switchMode('signup')} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === 'signup' ? 'bg-[#FF0000] text-white' : 'text-white/40 hover:text-white'}`}>
              Créer un compte
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Votre nom" required className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#FF0000] transition-all placeholder:text-white/20 text-sm" />
                </div>

                <div className="flex gap-2">
                  <div className="relative" ref={dropdownRef}>
                    <button type="button" onClick={() => { setDropdownOpen(!dropdownOpen); setCountrySearch(''); }} className="h-full flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-2xl px-3 py-4 hover:border-white/30 focus:outline-none focus:border-[#FF0000] transition-all text-sm whitespace-nowrap">
                      <span className="text-lg leading-none">{selectedCountry.flag}</span>
                      <span className="text-white/70 font-mono text-xs">{selectedCountry.dial}</span>
                      <ChevronDown className={`w-3 h-3 text-white/30 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {dropdownOpen && (
                      <div className="absolute left-0 top-full mt-2 w-72 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                        <div className="p-2 border-b border-white/10">
                          <input type="text" value={countrySearch} onChange={e => setCountrySearch(e.target.value)} placeholder="Rechercher un pays..." autoFocus className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-[#FF0000] placeholder:text-white/20 transition-all" />
                        </div>
                        <ul className="max-h-52 overflow-y-auto">
                          {filteredCountries.length === 0 ? (
                            <li className="px-4 py-3 text-white/30 text-sm">Aucun résultat</li>
                          ) : filteredCountries.map(c => (
                            <li key={c.code}>
                              <button type="button" onClick={() => { setSelectedCountry(c); setDropdownOpen(false); setCountrySearch(''); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors text-left ${selectedCountry.code === c.code ? 'bg-[#FF0000]/10 text-[#FF0000]' : 'text-white/80'}`}>
                                <span className="text-base">{c.flag}</span>
                                <span className="flex-1 truncate">{c.name}</span>
                                <span className="font-mono text-xs text-white/40">{c.dial}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="relative flex-1">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/[^\d\s\-(). ]/g, ''))} placeholder="Numéro de téléphone" required className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#FF0000] transition-all placeholder:text-white/20 text-sm" />
                  </div>
                </div>
              </>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Adresse email" required className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#FF0000] transition-all placeholder:text-white/20 text-sm" />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'Mot de passe (min. 6 caractères)' : 'Mot de passe'} required className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 focus:outline-none focus:border-[#FF0000] transition-all placeholder:text-white/20 text-sm" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full bg-[#FF0000] hover:bg-[#D90000] disabled:bg-white/10 disabled:text-white/20 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-2">
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</>
              ) : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>

          <p className="text-center text-white/30 text-xs">En continuant, vous acceptez nos conditions d'utilisation.</p>
        </div>
      </div>
    </div>
  );
}
