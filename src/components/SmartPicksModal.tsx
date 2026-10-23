"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Entry, SearchResult, Status } from "@/lib/types";
import { entryKey } from "@/lib/types";
import { fallbackColors } from "@/lib/spine";

type Props = {
  entries: Entry[];
  existing: Set<string>;
  onClose: () => void;
  onConfirm: (picks: SearchResult[], status: Status) => void;
};
type Meta = { matched: number; likedCount: number; total: number; latestYear: number };

/** Movies from your shelf the model can learn from: watched, on TMDB, and liked (4 stars or more, or not rated yet). */
const likedMovies = (entries: Entry[]) =>
  entries.filter((e) => e.status === "watched" && e.mediaType === "movie" && e.source === "tmdb" && (e.rating === 0 || e.rating >= 4)).map((e) => e.externalId);
const allMovies = (entries: Entry[]) => entries.filter((e) => e.mediaType === "movie" && e.source === "tmdb").map((e) => e.externalId);

const STEPS = [0, 0.25, 0.5, 0.75];

export default function SmartPicksModal({ entries, existing, onClose, onConfirm }: Props) {
  const [beta, setBeta] = useState(0.5);
  const [items, setItems] = useState<SearchResult[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, SearchResult>>({});
  const [focus, setFocus] = useState<SearchResult | null>(null);

  const liked = useMemo(() => likedMovies(entries), [entries]);
  const seen = useMemo(() => allMovies(entries), [entries]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ liked: liked.join(","), seen: seen.join(","), beta: String(beta), limit: "24" });
        const r = await fetch(`/api/smartpicks?${qs}`, { signal: ac.signal });
        const j = (await r.json()) as Meta & { results?: SearchResult[]; error?: string };
        setItems((j.results ?? []).filter((x) => !existing.has(entryKey(x))));
        setMeta({ matched: j.matched ?? 0, likedCount: j.likedCount ?? 0, total: j.total ?? 0, latestYear: j.latestYear ?? 2018 });
        setError(j.error ?? null);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError("Couldn’t reach Smart picks. Check your connection and try again.");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beta, liked, seen]);

  const count = Object.keys(picked).length;
  const covers = useMemo(() => new Map(items.map((i) => [entryKey(i), fallbackColors(i.title)])), [items]);
  const toggle = (r: SearchResult) =>
    setPicked((p) => {
      const k = entryKey(r);
      if (p[k]) {
        const { [k]: _gone, ...rest } = p;
        void _gone;
        return rest;
      }
      return { ...p, [k]: r };
    });

  const few = meta !== null && meta.matched < 3;

  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="sheet wide"
        role="dialog"
        aria-modal="true"
        aria-label="Smart picks, an experiment"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        <div className="sheet-head">
          <h2>Smart picks<span className="exp">experiment</span></h2>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="sheet-body">
          <p className="sp-note">
            Something I tried: I trained this model myself on 100,000 movie ratings from 600 people. It finds movies liked by people with a taste like yours.
            It only knows <b>movies up to 2018</b> (no series, nothing newer) and works best once you have 10+ movies on your shelf.{" "}
            <Link href="/model">How I trained it →</Link>
          </p>

          <div className="sp-slider">
            <span>Play it safe</span>
            <input
              type="range"
              min={0}
              max={0.75}
              step={0.25}
              list="sp-steps"
              value={beta}
              onChange={(e) => setBeta(Number(e.target.value))}
              aria-label="How adventurous the picks are"
            />
            <datalist id="sp-steps">{STEPS.map((s) => <option key={s} value={s} />)}</datalist>
            <span>Surprise me</span>
          </div>
          {meta && !few && <p className="note" style={{ marginTop: 6 }}>Based on {meta.matched} of your {meta.likedCount} liked movies that the model knows.</p>}

          {loading && (
            <div className="picks">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="pick skeleton" />)}</div>
          )}
          {error && <p className="hint err">{error}</p>}
          {!loading && !error && few && (
            <p className="hint">
              The model knows {meta?.matched ?? 0} of your movies so far. Add a few movies you liked that came out before {(meta?.latestYear ?? 2018) + 1} and its picks get much better.
              {items.length > 0 ? " Until then these are simply popular movies you haven't added." : ""}
            </p>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div className="picks">
                {items.map((r, i) => {
                  const k = entryKey(r);
                  const on = !!picked[k];
                  const c = covers.get(k)!;
                  return (
                    <motion.button
                      key={k}
                      type="button"
                      className={`pick${on ? " on" : ""}`}
                      aria-pressed={on}
                      aria-label={`${r.title}${r.year ? ` (${r.year})` : ""}, ${r.match}% match`}
                      initial={{ opacity: 0, y: 18, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: on ? 0.95 : 1 }}
                      transition={{ delay: Math.min(i, 14) * 0.03, type: "spring", stiffness: 260, damping: 22 }}
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.92 }}
                      onMouseEnter={() => setFocus(r)}
                      onFocus={() => setFocus(r)}
                      onClick={() => {
                        setFocus(r);
                        toggle(r);
                      }}
                    >
                      {r.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.thumb} alt="" loading="lazy" />
                      ) : (
                        <span className="pick-ph" style={{ "--c": c.color, "--ink-c": c.ink } as CSSProperties}>
                          <b>{r.title}</b>
                          <small>{r.year}</small>
                        </span>
                      )}
                      <span className="mpill">{r.match}%</span>
                      <motion.span className="tick" initial={false} animate={{ scale: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 26 }}>✓</motion.span>
                    </motion.button>
                  );
                })}
              </div>
              <p className="caption" aria-live="polite">
                {focus ? (
                  <>
                    <b>{focus.title}</b>
                    {focus.year ? ` (${focus.year})` : ""}
                    {focus.because?.length ? <> · because you liked {focus.because.join(" + ")}</> : null}
                  </>
                ) : (
                  "Tap a poster to select it. This line tells you why it was suggested. The % is a relative match, not a chance of liking it."
                )}
              </p>
            </>
          )}

          <div className="foot sticky">
            <button className="btn ghost small" onClick={onClose}>Close</button>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <motion.button className="btn" disabled={!count} whileTap={{ scale: 0.96 }} onClick={() => onConfirm(Object.values(picked), "want")}>
                {count ? `Add ${count} to want to watch` : "Pick a few"}
              </motion.button>
              <motion.button className="btn ghost" disabled={!count} whileTap={{ scale: 0.96 }} onClick={() => onConfirm(Object.values(picked), "watched")}>
                {count ? `I’ve watched ${count}` : "Already seen"}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
