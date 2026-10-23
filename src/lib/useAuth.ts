"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { AuthResult } from "./useShelf";

const friendly = (m: string) => (/fetch|network/i.test(m) ? "Can’t reach the server. Check your connection and try again." : m);

/** Just the sign-in state and the sign-in/sign-up actions, for pages that only need to know who is looking (e.g. public shelves). */
export function useAuth() {
  const [ready, setReady] = useState(!supabase);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { ok: false, message: "Accounts aren't set up yet." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { ok: false, message: friendly(error.message) } : { ok: true };
  }, []);

  const signUp = useCallback(async (email: string, password: string, username: string): Promise<AuthResult> => {
    if (!supabase) return { ok: false, message: "Accounts aren't set up yet." };
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username: username.toLowerCase() }, emailRedirectTo: window.location.origin } });
    if (error) return { ok: false, message: friendly(error.message) };
    return { ok: true, needsConfirm: !data.session };
  }, []);

  return { ready, backend: !!supabase, user, signIn, signUp };
}
