"use client";

import { useEffect, useRef } from "react";
import type { Draft, Entry, SearchResult } from "./types";
import { entryKey } from "./types";
import { draftFromResult } from "./draft";

/**
 * Titles added before search covered everything (or while TMDB wasn't connected) have no poster.
 * Once TMDB is available, quietly match each one to the real title and fill in poster, creator and genres,
 * keeping the person's own rating, date and notes.
 */
export function useRepairPosters(ready: boolean, entries: Entry[], update: (id: string, d: Draft) => Promise<Entry>) {
  const tried = useRef(new Set<string>());

  useEffect(() => {
    if (!ready) return;
    const todo = entries.filter((e) => e.source === "demo" && !tried.current.has(e.id));
    if (!todo.length) return;
    let cancelled = false;
    (async () => {
      for (const e of todo) {
        if (cancelled) return;
        tried.current.add(e.id);
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(e.title)}`);
          const j = (await res.json()) as { results?: SearchResult[]; provider?: string };
          if (j.provider !== "tmdb") return; // no TMDB key: nothing to match against
          const hit = (j.results ?? []).find(
            (x) => x.mediaType === e.mediaType && x.title.toLowerCase() === e.title.toLowerCase() && (!e.year || !x.year || Math.abs(x.year - e.year) <= 1),
          );
          if (!hit || entries.some((o) => o.id !== e.id && entryKey(o) === entryKey(hit))) continue;
          const d = await draftFromResult(hit, e.status);
          await update(e.id, { ...d, rating: e.rating, watchedOn: e.watchedOn, liked: e.liked, learned: e.learned });
        } catch {
          /* leave it as it is; it will be retried next visit */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, entries, update]);
}
