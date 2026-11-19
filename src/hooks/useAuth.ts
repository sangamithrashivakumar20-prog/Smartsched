import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export interface AuthActionResult {
  ok: boolean;
  error?: string;
  needsEmailConfirmation?: boolean;
}

function mapSupabaseAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please check your credentials and try again.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email address using the link sent to your inbox before signing in.';
  }
  if (lower.includes('user already registered')) {
    return 'An account with this email already exists. Try signing in or resetting your password.';
  }
  if (lower.includes('password should be at least')) {
    return 'Password must be at least 6 characters long.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  return message;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [isRecoveryMode, setIsRecoveryMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.hash.includes('type=recovery') ||
      window.location.pathname === '/reset-password'
    );
  });

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      } else if (event === 'SIGNED_OUT') {
        setIsRecoveryMode(false);
      }
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      if (!supabase) {
        return {
          ok: false,
          error:
            'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.',
        };
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        return { ok: false, error: mapSupabaseAuthError(error.message) };
      }
      setSession(data.session ?? null);
      setUser(data.user ?? null);
      setIsRecoveryMode(false);
      return { ok: true };
    },
    []
  );

  const signUp = useCallback(
    async (
      name: string,
      email: string,
      password: string
    ): Promise<AuthActionResult> => {
      if (!supabase) {
        return {
          ok: false,
          error:
            'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.',
        };
      }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
          },
          emailRedirectTo:
            typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });
      if (error) {
        return { ok: false, error: mapSupabaseAuthError(error.message) };
      }
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        setIsRecoveryMode(false);
        return { ok: true, needsEmailConfirmation: false };
      }
      return { ok: true, needsEmailConfirmation: true };
    },
    []
  );

  const requestPasswordReset = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      if (!supabase) {
        return {
          ok: false,
          error:
            'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.',
        };
      }
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/reset-password`
          : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (error) {
        return { ok: false, error: mapSupabaseAuthError(error.message) };
      }
      return { ok: true };
    },
    []
  );

  const updatePassword = useCallback(
    async (newPassword: string): Promise<AuthActionResult> => {
      if (!supabase) {
        return {
          ok: false,
          error:
            'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.',
        };
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { ok: false, error: mapSupabaseAuthError(error.message) };
      }
      setIsRecoveryMode(false);
      return { ok: true };
    },
    []
  );

  const signOut = useCallback(async (): Promise<void> => {
    setIsRecoveryMode(false);
    setSession(null);
    setUser(null);
    if (supabase) {
      await supabase.auth.signOut();
    }
  }, []);

  const studentName =
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    user?.email?.split('@')[0] ||
    'Student';

  return {
    session,
    user,
    studentName,
    loading,
    isRecoveryMode,
    isSupabaseConfigured,
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    signOut,
  };
}
