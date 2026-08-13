import { useState, useEffect, type ReactNode } from 'react';
import { Home, Youtube, Megaphone, Image as ImageIcon, Shield, LogOut, Crown, X } from 'lucide-react';
import type { LoggedUser } from '../pages/AuthPage';
import * as db from '../lib/db';

export type Page = 'home' | 'app' | 'content' | 'thumbnail' | 'admin';

const FREE_LIMIT = 5;
const STANDARD_LIMIT_MONTHLY = 60;
const STANDARD_LIMIT_ANNUAL = 100;

type NavItem = { page: Page; label: string; icon: ReactNode };

type Props = {
  user: LoggedUser;
  activePage: Page;
  isAdmin: boolean;
  onNavigate: (page: Page) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export default function Sidebar({ user, activePage, isAdmin, onNavigate, onOpenProfile, onLogout, mobileOpen, onCloseMobile }: Props) {
  const [plan, setPlan] = useState<'free' | 'standard'>('free');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [monthlyUsage, setMonthlyUsage] = useState(0);

  useEffect(() => {
    db.getProfile(user.id).then(p => { setPlan(p.plan); setBillingCycle(p.billingCycle); }).catch(() => {});
    db.getMonthlyUsage(user.id).then(setMonthlyUsage).catch(() => {});
  }, [user.id, activePage]);

  const isStandard = plan === 'standard';
  const scriptLimit = isStandard ? (billingCycle === 'annual' ? STANDARD_LIMIT_ANNUAL : STANDARD_LIMIT_MONTHLY) : FREE_LIMIT;

  const navItems: NavItem[] = [
    { page: 'home', label: 'Accueil', icon: <Home className="w-4 h-4" /> },
    { page: 'app', label: 'Script YouTube', icon: <Youtube className="w-4 h-4" /> },
    { page: 'content', label: 'Post Multiplateforme', icon: <Megaphone className="w-4 h-4" /> },
    { page: 'thumbnail', label: 'Miniature', icon: <ImageIcon className="w-4 h-4" /> },
  ];
  if (isAdmin) navItems.push({ page: 'admin', label: 'Admin', icon: <Shield className="w-4 h-4" /> });

  const navigate = (page: Page) => { onNavigate(page); onCloseMobile(); };

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onCloseMobile} />
      )}
      <aside className={`fixed top-0 left-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col z-50 transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        <div className="flex items-center justify-between gap-2 px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <img src="https://images.chariowcdn.com/cdn-cgi/image/format=auto,onerror=redirect,quality=medium-high,slow-connection-quality=50/https://assets.chariowcdn.com/assets/store_udv1gsypk62r/OAcPlra4gZkj4g0IwsDyTNxGlId1hIxTP7K8FHMl.jpg" alt="logo" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
            <span className="font-bold tracking-tighter text-sm truncate">YouScript <span className="text-[#FF0000]">Booster</span></span>
          </div>
          <button onClick={onCloseMobile} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 lg:hidden flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.page}
              onClick={() => navigate(item.page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activePage === item.page ? 'bg-[#FF0000]/10 text-[#FF0000]' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="px-3 pb-3">
          <button onClick={() => navigate('app')} className="w-full text-left p-3 rounded-2xl bg-gradient-to-br from-[#FF0000]/[0.06] to-orange-500/[0.03] border border-[#FF0000]/20 space-y-1.5 hover:border-[#FF0000]/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1"><Crown className="w-3 h-3 text-[#FF0000]" /> {isStandard ? `Standard · ${billingCycle === 'annual' ? 'Annuel' : 'Mensuel'}` : 'Gratuit'}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full transition-all ${monthlyUsage >= scriptLimit ? 'bg-red-500' : 'bg-[#FF0000]'}`} style={{ width: `${Math.min(100, (monthlyUsage / scriptLimit) * 100)}%` }} />
            </div>
            <p className="text-[11px] text-gray-500">{monthlyUsage}/{scriptLimit} scripts ce mois</p>
          </button>
        </div>

        <div className="px-3 pb-4 pt-2 border-t border-gray-100 flex items-center gap-2">
          <button onClick={onOpenProfile} className="flex-1 flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-gray-50 transition-all min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#FF0000]/10 border border-[#FF0000]/20 flex items-center justify-center text-xs font-bold text-[#FF0000] flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
              <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
            </div>
          </button>
          <button onClick={onLogout} title="Se déconnecter" className="p-2 rounded-xl bg-gray-50 border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-all group flex-shrink-0">
            <LogOut className="w-4 h-4 text-gray-400 group-hover:text-red-600 transition-colors" />
          </button>
        </div>
      </aside>
    </>
  );
}
