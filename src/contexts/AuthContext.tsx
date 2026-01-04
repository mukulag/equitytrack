import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    try {
      // First attempt to revoke server-side sessions for the current user
      if (session?.user) {
        try {
          await supabase.functions.invoke('revoke-user-sessions', {
            body: { user_id: session.user.id },
          });
        } catch (e) {
          // If server-side revoke fails, continue with client sign out
          console.error('Failed to revoke server sessions:', e);
        }
      }

      // Client-side sign out
      await supabase.auth.signOut();

      // Clear any lingering auth-related localStorage entries to reduce risk of token leakage
      try {
        Object.keys(localStorage).forEach((k) => {
          if (k.toLowerCase().includes('supabase') || k.toLowerCase().includes('sb-') || k.toLowerCase().includes('auth')) {
            localStorage.removeItem(k);
          }
        });
      } catch (e) {
        // ignore
      }

      // Remove access tokens from URL (if present)
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        if (url.hash && (url.hash.includes('access_token') || url.hash.includes('refresh_token') || url.hash.includes('type='))) {
          window.history.replaceState({}, '', url.pathname + url.search);
        }
        // Redirect to auth route explicitly
        window.location.href = '/auth';
      }
    } catch (e) {
      console.error('Error signing out:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
