import { useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import type { LoggedUser } from '../pages/AuthPage';
import Sidebar, { type Page } from './Sidebar';
import ProfileModal from './ProfileModal';

type Props = {
  user: LoggedUser;
  activePage: Page;
  isAdmin: boolean;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  children: ReactNode;
};

export default function AppShell({ user, activePage, isAdmin, onNavigate, onLogout, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <Sidebar
        user={user}
        activePage={activePage}
        isAdmin={isAdmin}
        onNavigate={onNavigate}
        onOpenProfile={() => setShowProfileModal(true)}
        onLogout={onLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="lg:pl-64">
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-white/90 backdrop-blur-md border-b border-gray-100">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-600">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold tracking-tighter text-sm">YouScript <span className="text-[#FF0000]">Booster</span></span>
        </div>

        <main className="overflow-x-hidden">
          {children}
        </main>
      </div>

      <ProfileModal
        user={user}
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onUpgrade={() => { setShowProfileModal(false); onNavigate('app'); }}
      />
    </div>
  );
}
