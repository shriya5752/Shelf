"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Draft, Entry } from "./types";
import { entryKey } from "./types";
import { supabase } from "./supabase";
import * as db from "./db";
import { loadLocal, saveLocal } from "./local";
import { sortEntries } from "./format";

const friendly = (m: string) => (/fetch|network/i.test(m) ? "Can’t reach the server. Check your connection and try again." : m);

export type AuthResult = { ok: true; needsConfirm?: boolean } | { ok: false; message: string };

const STARTED_KEY = "shelf.started.v1";

const toDraft = (e: Entry): Draft => ({
  source: e.source, externalId: e.externalId, mediaType: e.mediaType, title: e.title, year: e.year, creator: e.creator,
  genres: e.genres, posterUrl: e.posterUrl, color: e.color, ink: e.ink, seasons: e.seasons, status: e.status, rating: e.rating,
  watchedOn: e.watchedOn, liked: e.liked, learned: e.learned,
});

/**
 * Your shelf.
 *  - signed in  -> saved to your Supabase account
 *  - guest      -> saved in this browser (and moved into your account when you sign up / in)
 * With no Supabase configured at all, it is guest-only ("demo mode").
 */
export function useShelf() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<db.Profile | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  // --- boot: restore session, or load the guest shelf ---
  useEffect(() => {
    try {
      setStarted(localStorage.getItem(STARTED_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
    if (!supabase) {
      setEntries(loadLocal());
      setReady(true);
      return;
    }
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setUser(data.session?.user ?? null);
      if (!data.session) {
        setEntries(loadLocal());
        setReady(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        setProfile(null);
        setEntries(loadLocal());
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // --- signed in: load the account, first moving over anything built as a guest ---
  const userId = user?.id;
  useEffect(() => {
    if (!supabase || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const guest = loadLocal();
        if (guest.length) {
          const have = new Set((await db.listEntries(userId)).map(entryKey));
          for (const g of guest) {
            if (have.has(entryKey(g))) continue;
            try {
              await db.insertEntry(userId, toDraft(g));
            } catch {
              /* skip a title that can't be saved, keep going */
            }
          }
          saveLocal([]);
        }
        const [p, list] = await Promise.all([db.getMyProfile(userId), db.listEntries(userId)]);
        if (cancelled) return;
        setProfile(p);
        setEntries(list);
        setError(null);
      } catch {
        if (!cancelled) setError("Couldn't load your shelf. Check your connection and refresh.");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const start = useCallback(() => {
    try {
      localStorage.setItem(STARTED_KEY, "1");
    } catch {
      /* ignore */
    }
    setStarted(true);
  }, []);

  const add = useCallback(
    async (d: Draft): Promise<Entry> => {
      if (userId) {
        const e = await db.insertEntry(userId, d);
        setEntries((prev) => [...prev, e]);
        return e;
      }
      const e: Entry = { ...d, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      setEntries((prev) => {
        const next = [...prev, e];
        saveLocal(next);
        return next;
      });
      return e;
    },
    [userId],
  );

  const update = useCallback(
    async (id: string, d: Draft): Promise<Entry> => {
      if (userId) {
        const e = await db.updateEntry(userId, id, d);
        setEntries((prev) => prev.map((x) => (x.id === id ? e : x)));
        return e;
      }
      let result!: Entry;
      setEntries((prev) => {
        const next = prev.map((e) => (e.id === id ? (result = { ...e, ...d }) : e));
        saveLocal(next);
        return next;
      });
      return result;
    },
    [userId],
  );

  const remove = useCallback(
    async (id: string) => {
      if (userId) {
        await db.deleteEntry(userId, id);
        setEntries((prev) => prev.filter((e) => e.id !== id));
        return;
      }
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        saveLocal(next);
        return next;
      });
    },
    [userId],
  );

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { ok: false, message: "Accounts aren't set up yet." };
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    return err ? { ok: false, message: friendly(err.message) } : { ok: true };
  }, []);

  const signUp = useCallback(async (email: string, password: string, username: string): Promise<AuthResult> => {
    if (!supabase) return { ok: false, message: "Accounts aren't set up yet." };
    const { data, error: err } = await supabase.auth.signUp({ email, password, options: { data: { username: username.toLowerCase() } } });
    if (err) return { ok: false, message: friendly(err.message) };
    return { ok: true, needsConfirm: !data.session };
  }, []);

  const saveProfile = useCallback(
    async (patch: { username?: string; displayName?: string | null; isPublic?: boolean }): Promise<{ ok: true } | { ok: false; message: string }> => {
      if (!userId) return { ok: false, message: "Sign in first." };
      try {
        const p = await db.updateProfile(userId, patch);
        setProfile(p);
        return { ok: true };
      } catch (err) {
        const e = err as { code?: string; message?: string };
        if (e.code === "23505") return { ok: false, message: "That username is already taken." };
        if (e.code === "23514") return { ok: false, message: "Usernames use 3–20 lowercase letters, numbers or underscores." };
        return { ok: false, message: friendly(e.message ?? "Couldn’t save. Please try again.") };
      }
    },
    [userId],
  );

  const changePassword = useCallback(async (password: string): Promise<{ ok: true } | { ok: false; message: string }> => {
    if (!supabase) return { ok: false, message: "Accounts aren’t set up yet." };
    const { error: err } = await supabase.auth.updateUser({ password });
    return err ? { ok: false, message: friendly(err.message) } : { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const sorted = useMemo(() => sortEntries(entries), [entries]);

  return {
    ready, backend: !!supabase, user, profile, entries: sorted, error, started, start,
    add, update, remove, signIn, signUp, signOut, saveProfile, changePassword,
  };
}
