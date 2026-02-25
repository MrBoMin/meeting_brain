import { useState, useEffect } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSession, onAuthStateChange } from '../services/authService';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getSession()
      .then((s) => {
        setSession(s);
        setUser(s?.user ?? null);
      })
      .catch(() => {
        setSession(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));

    const subscription = onAuthStateChange((s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { session, user, isLoading, isAuthenticated: !!session };
}
