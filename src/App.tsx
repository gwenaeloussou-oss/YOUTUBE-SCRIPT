import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import AuthPage, { type LoggedUser } from './pages/AuthPage';
import AppPage from './pages/AppPage';
import { supabase } from './lib/supabase';

type Page = 'landing' | 'auth' | 'app';

export default function App() {
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [page, setPage] = useState<Page>('landing');
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user;
        setUser({ id: u.id, name: u.user_metadata?.name ?? u.email ?? '', email: u.email ?? '' });
        setPage('app');
      }
      setInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const u = session.user;
        setUser({ id: u.id, name: u.user_metadata?.name ?? u.email ?? '', email: u.email ?? '' });
        setPage('app');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setPage('landing');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = (loggedUser: LoggedUser) => {
    setUser(loggedUser);
    setPage('app');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPage('landing');
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#FF0000] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (page === 'landing') return <LandingPage onStart={() => setPage('auth')} />;
  if (page === 'auth') return <AuthPage onBack={() => setPage('landing')} onAuth={handleAuth} />;
  return <AppPage user={user!} onLogout={handleLogout} />;
}
