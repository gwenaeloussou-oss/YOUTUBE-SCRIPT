/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import LandingPage from './pages/LandingPage';
import AuthPage, { type LoggedUser } from './pages/AuthPage';
import AppPage from './pages/AppPage';

type Page = 'landing' | 'auth' | 'app';

function getSession(): LoggedUser | null {
  try {
    const s = localStorage.getItem('youscript_session');
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState<LoggedUser | null>(getSession);
  const [page, setPage] = useState<Page>(user ? 'app' : 'landing');

  const handleAuth = (loggedUser: LoggedUser) => {
    setUser(loggedUser);
    setPage('app');
  };

  const handleLogout = () => {
    localStorage.removeItem('youscript_session');
    setUser(null);
    setPage('landing');
  };

  if (page === 'landing') {
    return <LandingPage onStart={() => setPage('auth')} />;
  }

  if (page === 'auth') {
    return <AuthPage onBack={() => setPage('landing')} onAuth={handleAuth} />;
  }

  return <AppPage user={user!} onLogout={handleLogout} />;
}
