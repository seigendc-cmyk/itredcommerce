import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

// Console-operator auth (DL-045). Unlike staff/executive/rider, console
// operators are real people with real emails — sign-in is Supabase Auth's
// native signInWithPassword, no PIN bridge. is_console_operator() (a thin
// wrapper around app_is_super_admin(), granted to `authenticated`) is the
// one thing this app calls right after any session appears, because a
// correct password for a real Supabase Auth user who simply isn't a console
// operator must surface as "not authorized" — RLS alone would just leave
// every table silently empty, which reads as a broken app, not a refusal.
export type ConsoleAuthStatus = 'loading' | 'signed-out' | 'unauthorized' | 'authorized';

interface ConsoleAuthState {
  status: ConsoleAuthStatus;
  operatorEmail: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const ConsoleAuthContext = createContext<ConsoleAuthState | null>(null);

export function useConsoleAuth(): ConsoleAuthState {
  const ctx = useContext(ConsoleAuthContext);
  if (!ctx) throw new Error('useConsoleAuth must be used within ConsoleAuthProvider');
  return ctx;
}

async function checkIsOperator(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_console_operator');
  if (error) {
    console.error('[consoleAuth] is_console_operator check failed:', error);
    return false;
  }
  return data === true;
}

export const ConsoleAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<ConsoleAuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  // Set just before we force a sign-out of a signed-in-but-not-an-operator
  // session, so the resulting onAuthStateChange(null) event reports
  // "unauthorized" instead of the generic "signed-out" a real user-initiated
  // sign-out should produce.
  const rejectingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function evaluate(nextSession: Session | null) {
      if (!nextSession) {
        if (cancelled) return;
        setSession(null);
        setStatus(rejectingRef.current ? 'unauthorized' : 'signed-out');
        rejectingRef.current = false;
        return;
      }

      const isOperator = await checkIsOperator();
      if (cancelled) return;

      if (!isOperator) {
        rejectingRef.current = true;
        await supabase.auth.signOut();
        return;
      }

      setSession(nextSession);
      setStatus('authorized');
    }

    supabase.auth.getSession().then(({ data }) => evaluate(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      evaluate(nextSession);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value: ConsoleAuthState = {
    status,
    operatorEmail: session?.user.email ?? null,
    signIn,
    signOut,
  };

  return <ConsoleAuthContext.Provider value={value}>{children}</ConsoleAuthContext.Provider>;
};
