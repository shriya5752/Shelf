"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Draft, Entry, SearchResult, Status } from "@/lib/types";
import { entryKey } from "@/lib/types";
import { bestMatch, parseList, type ParsedLine } from "@/lib/importList";
import { draftFromResult } from "@/lib/draft";

type Props = {
  existing: Set<string>;
  defaultStatus: Status;
  onAdd: (d: Draft) => Promise<Entry>;
  onRemove: (id: string) => Promise<void>;
  onClose: () => void;
  onDone: (added: number) => void;
};

type Row =
  | { kind: "added"; line: ParsedLine; entry: Entry; removed?: boolean }
  | { kind: "skipped"; line: ParsedLine; why: string }
  | { kind: "missing"; line: ParsedLine };

const PLACEHOLDER = `Inception (2010)
Breaking Bad [series]
Titanic
Gilmore Girls (2000) [series]`;

/** Runs `fn` over items with a few in flight at once, keeping results in order. */
function pool<T, R>(items: T[], size: number, fn: (x: T, i: number) => Promise<R>): Promise<R>[] {
  const results: Promise<R>[] = [];
  let running = 0;
  const waiters: (() => void)[] = [];
  const acquire = () => (running < size ? (running++, Promise.resolve()) : new Promise<void>((res) => waiters.push(() => (running++, res()))));
  const release = () => {
    running--;
    waiters.shift()?.();
  };
  items.forEach((x, i) => {
    results.push(
      acquire().then(async () => {
        try {
          return await fn(x, i);
        } finally {
          release();
        }
      }),
    );
  });
  return results;
}

export default function ImportModal({ existing, defaultStatus, onAdd, onRemove, onClose, onDone }: Props) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>(defaultStatus);
  const [phase, setPhase] = useState<"input" | "running" | "done">("input");
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [rows, setRows] = useState<Row[]>([]);
  const cancelled = useRef(false);

  const lines = useMemo(() => parseList(text), [text]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && phase !== "running" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, phase]);
  useEffect(() => () => void (cancelled.current = true), []);

  async function run() {
    if (!lines.length) return;
    cancelled.current = false;
    setPhase("running");
    setRows([]);
    setProgress({ done: 0, total: lines.length, current: "" });
    const have = new Set(existing);
    const out: Row[] = [];

    // look up + build each draft a few at a time, then save in the order pasted (so the shelf keeps your order)
    type Prepared = { line: ParsedLine; match: SearchResult | null; draft: Draft | null };
    const prepared = pool(lines, 4, async (line): Promise<Prepared> => {
      try {
        const get = async (extra: string): Promise<SearchResult[]> => {
          const res = await fetch(`/api/search?q=${encodeURIComponent(line.title)}&limit=20${extra}`);
          return ((await res.json()) as { results?: SearchResult[] }).results ?? [];
        };
        // ask for the right type + year first, so a famous title isn't buried under its sequels and spin-offs
        const yr = line.year ? `&year=${line.year}` : "";
        let found: SearchResult[];
        if (line.tv === true) found = await get(`&type=tv${yr}`);
        else if (line.tv === false) found = await get(`&type=movie${yr}`);
        else if (line.year) found = (await Promise.all([get(`&type=movie${yr}`), get(`&type=tv${yr}`)])).flat();
        else found = await get("");
        let match = bestMatch(found, line);
        if (!match) match = bestMatch(await get(""), line);
        if (!match) return { line, match: null, draft: null };
        if (have.has(entryKey(match))) return { line, match, draft: null };
        return { line, match, draft: await draftFromResult(match, status) };
      } catch {
        return { line, match: null, draft: null };
      }
    });

    let added = 0;
    for (let i = 0; i < prepared.length; i++) {
      if (cancelled.current) return;
      const p = await prepared[i];
      setProgress({ done: i, total: lines.length, current: p.line.title });
      let row: Row;
      if (!p.match) row = { kind: "missing", line: p.line };
      else if (have.has(entryKey(p.match))) row = { kind: "skipped", line: p.line, why: "Already on your shelf" };
      else if (!p.draft) row = { kind: "missing", line: p.line };
      else {
        try {
          const entry = await onAdd(p.draft);
          have.add(entryKey(p.match));
          added++;
          row = { kind: "added", line: p.line, entry };
        } catch {
          row = { kind: "missing", line: p.line };
        }
      }
      out.push(row);
    }
    setRows(out);
    setProgress({ done: lines.length, total: lines.length, current: "" });
    setPhase("done");
    onDone(added);
  }

  const counts = {
    added: rows.filter((r) => r.kind === "added" && !r.removed).length,
    skipped: rows.filter((r) => r.kind === "skipped").length,
    missing: rows.filter((r) => r.kind === "missing").length,
  };

  return (
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onMouseDown={(e) => e.target === e.currentTarget && phase !== "running" && onClose()}
    >
      <motion.div
        className="sheet wide"
        role="dialog"
        aria-modal="true"
        aria-label="Import a list"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        <div className="sheet-head">
          <h2>{phase === "done" ? "Import finished" : "Import a list"}</h2>
          <button className="x" onClick={onClose} disabled={phase === "running"} aria-label="Close">✕</button>
        </div>
        <div className="sheet-body">
          {phase === "input" && (
            <>
              <p className="hint" style={{ marginTop: 0 }}>
                Paste titles, one per line. Add the year to be exact, and <b>[series]</b> for shows. Each one is found on TMDB and added with its poster.
              </p>
              <label className="field" style={{ marginTop: 10 }}>
                <textarea
                  className="paste"
                  rows={11}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={PLACEHOLDER}
                  spellCheck={false}
                  autoFocus
                  aria-label="Titles to import"
                />
              </label>
              <div className="foot" style={{ flexWrap: "wrap" }}>
                <div className="seg" role="tablist" aria-label="Add them to">
                  {(["watched", "want"] as const).map((st) => (
                    <button key={st} type="button" role="tab" aria-selected={status === st} className={`segbtn${status === st ? " on" : ""}`} onClick={() => setStatus(st)}>
                      {status === st && <motion.span layoutId="impseg" className="bg" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                      <span>{st === "watched" ? "Watched" : "Want to watch"}</span>
                    </button>
                  ))}
                </div>
                <button className="btn" disabled={!lines.length} onClick={run}>
                  {lines.length ? `Import ${lines.length} title${lines.length === 1 ? "" : "s"}` : "Paste a list"}
                </button>
              </div>
            </>
          )}

          {phase === "running" && (
            <div style={{ padding: "12px 0 6px" }}>
              <p className="hint" style={{ margin: 0 }}>
                <span className="spinner" />
                {progress.current ? `Adding ${progress.current}…` : "Finding titles…"}
              </p>
              <div className="prog"><motion.i animate={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} /></div>
              <p className="note" style={{ marginTop: 0 }}>{progress.done} of {progress.total}. Keep this window open.</p>
            </div>
          )}

          {phase === "done" && (
            <>
              <p className="hint" style={{ marginTop: 0 }}>
                <b>{counts.added}</b> added
                {counts.skipped > 0 && <> · <b>{counts.skipped}</b> already there</>}
                {counts.missing > 0 && <> · <b>{counts.missing}</b> not found</>}. Check the matches below — if one is the wrong film, remove it and add the right one with “+ Add a title”.
              </p>
              <div className="imp-list">
                {rows.map((r, i) => (
                  <motion.div key={i} className={`imp-row${r.kind === "added" && r.removed ? " gone" : ""}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.025 }}>
                    {r.kind === "added" ? (
                      r.entry.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="mini" src={r.entry.posterUrl} alt="" />
                      ) : (
                        <span className="mini" style={{ background: r.entry.color }} />
                      )
                    ) : (
                      <span className="mini ph" />
                    )}
                    <div>
                      <b>{r.kind === "added" ? r.entry.title : r.line.title}</b>
                      <small>
                        {r.kind === "added"
                          ? `${r.entry.mediaType === "tv" ? "Series" : "Movie"}${r.entry.year ? ` · ${r.entry.year}` : ""}${r.line.title.toLowerCase() !== r.entry.title.toLowerCase() ? ` · you wrote “${r.line.title}”` : ""}`
                          : r.kind === "skipped"
                            ? r.why
                            : "Couldn’t find a match"}
                      </small>
                    </div>
                    {r.kind === "added" ? (
                      r.removed ? (
                        <span className="st skip">Removed</span>
                      ) : (
                        <button
                          className="mini-btn text"
                          onClick={async () => {
                            try {
                              await onRemove(r.entry.id);
                              setRows((prev) => prev.map((x, k) => (k === i && x.kind === "added" ? { ...x, removed: true } : x)));
                            } catch {
                              /* leave it */
                            }
                          }}
                        >
                          Wrong? Remove
                        </button>
                      )
                    ) : (
                      <span className={`st ${r.kind === "skipped" ? "skip" : "bad"}`}>{r.kind === "skipped" ? "Skipped" : "Not found"}</span>
                    )}
                  </motion.div>
                ))}
              </div>
              <div className="foot">
                <span />
                <button className="btn" onClick={onClose}>Done</button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
