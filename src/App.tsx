import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import AuthPage, { type LoggedUser } from './pages/AuthPage';
import HomePage from './pages/HomePage';
import AppPage from './pages/AppPage';
import AdminPage from './pages/AdminPage';
import ContentStudioPage from './pages/ContentStudioPage';
import AppShell from './components/AppShell';
import type { Page as ShellPage } from './components/Sidebar';
import { supabase } from './lib/supabase';

const ADMIN_EMAIL = 'gwenaeloussou@gmail.com';

type Page = 'landing' | 'auth' | ShellPage;

export default function App() {
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [page, setPage] = useState<Page>('landing');
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user;
        setUser({ id: u.id, name: u.user_metadata?.name ?? u.email ?? '', email: u.email ?? '' });
        setPage('home');
      }
      setInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const u = session.user;
        setUser({ id: u.id, name: u.user_metadata?.name ?? u.email ?? '', email: u.email ?? '' });
        setPage('home');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setPage('landing');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = (loggedUser: LoggedUser) => {
    setUser(loggedUser);
    setPage('home');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPage('landing');
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#FF0000] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (page === 'landing') return <LandingPage onStart={() => setPage('auth')} />;
  if (page === 'auth') return <AuthPage onBack={() => setPage('landing')} onAuth={handleAuth} />;

  const isAdmin = user?.email === ADMIN_EMAIL;
  const shellPage = (page === 'home' || page === 'app' || page === 'content' || page === 'admin') ? page : 'home';

  return (
    <AppShell user={user!} activePage={shellPage} isAdmin={isAdmin} onNavigate={setPage} onLogout={handleLogout}>
      {shellPage === 'home' && <HomePage user={user!} onNavigate={setPage} />}
      {shellPage === 'app' && <AppPage user={user!} />}
      {shellPage === 'content' && <ContentStudioPage user={user!} />}
      {shellPage === 'admin' && isAdmin && <AdminPage user={user!} />}
    </AppShell>
  );
}
