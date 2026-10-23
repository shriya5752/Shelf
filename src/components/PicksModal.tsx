"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import type { SearchResult, Status } from "@/lib/types";
import { entryKey } from "@/lib/types";
import { fallbackColors } from "@/lib/spine";

export type PickAction = { label: (n: number) => string; status: Status; ghost?: boolean };

type Props = {
  existing: Set<string>;
  endpoint?: string;
  heading?: string;
  blurb?: string;
  emptyText?: string;
  actions?: PickAction[];
  skipLabel?: string;
  onClose: () => void;
  onConfirm: (picks: SearchResult[], status: Status) => void;
};

const DEFAULT_ACTIONS: PickAction[] = [{ label: (n) => (n ? `Add ${n} to my shelf` : "Pick a few"), status: "watched" }];

export default function PicksModal({
  existing,
  endpoint = "/api/discover",
  heading = "Seen any of these?",
  blurb = "Tap what you’ve watched to start your shelf. You can add dates and notes later, and search for anything else.",
  emptyText = "Nothing to show yet.",
  actions = DEFAULT_ACTIONS,
  skipLabel = "Skip, I’ll search",
  onClose,
  onConfirm,
}: Props) {
  const [items, setItems] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, SearchResult>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch(endpoint, { signal: ac.signal });
        const j = (await r.json()) as { results?: SearchResult[]; error?: string };
        setItems((j.results ?? []).filter((x) => !existing.has(entryKey(x))));
        setError(j.error ?? null);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError("Couldn’t load titles. You can still search for anything.");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

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

  return (
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="sheet wide"
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        <div className="sheet-head">
          <h2>{heading}</h2>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="sheet-body">
          <p className="hint" style={{ marginTop: 0 }}>{blurb}</p>

          {loading && (
            <div className="picks">
              {Array.from({ length: 12 }).map((_, i) => <div key={i} className="pick skeleton" />)}
            </div>
          )}
          {error && <p className="hint err">{error}</p>}
          {!loading && !error && items.length === 0 && <p className="hint">{emptyText}</p>}

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
                  aria-label={`${r.title}${r.year ? ` (${r.year})` : ""}`}
                  initial={{ opacity: 0, y: 18, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: on ? 0.95 : 1 }}
                  transition={{ delay: Math.min(i, 14) * 0.03, type: "spring", stiffness: 260, damping: 22 }}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => toggle(r)}
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
                  <motion.span
                    className="tick"
                    initial={false}
                    animate={{ scale: on ? 1 : 0, opacity: on ? 1 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 26 }}
                  >
                    ✓
                  </motion.span>
                </motion.button>
              );
            })}
          </div>

          <div className="foot sticky">
            <button className="btn ghost small" onClick={onClose}>{skipLabel}</button>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              {actions.map((a) => (
                <motion.button
                  key={a.status + a.label(0)}
                  className={`btn${a.ghost ? " ghost" : ""}`}
                  disabled={!count}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onConfirm(Object.values(picked), a.status)}
                >
                  {a.label(count)}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
