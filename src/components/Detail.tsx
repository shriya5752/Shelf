"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import type { Entry, SearchResult, Status } from "@/lib/types";
import { entryKey } from "@/lib/types";
import { fmtDate } from "@/lib/format";

type Props = {
  entry: Entry;
  onClose: () => void;
  onEdit?: (e: Entry) => void;
  onDelete?: (e: Entry) => Promise<void>;
  /** on a want-to-watch title: 'I've watched it' */
  onWatched?: (e: Entry) => void;
  /** add a recommended title (owner only) */
  onAddRec?: (r: SearchResult, status: Status) => Promise<void>;
  existing?: Set<string>;
};

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.28 } } };
const rise = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 160, damping: 20 } } };

export default function Detail({ entry: e, onClose, onEdit, onDelete, onWatched, onAddRec, existing }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recs, setRecs] = useState<SearchResult[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());

  // "if you liked this": TMDB recommendations for this title
  const seed = e.source === "tmdb" ? `${e.mediaType}:${e.externalId}` : null;
  useEffect(() => {
    if (!seed) return;
    const ac = new AbortController();
    fetch(`/api/recommend?seeds=${seed}&limit=10`, { signal: ac.signal })
      .then((r) => r.json())
      .then((j: { results?: SearchResult[] }) => setRecs((j.results ?? []).filter((x) => !existing?.has(entryKey(x))).slice(0, 8)))
      .catch(() => {});
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stars = e.rating ? "★".repeat(e.rating) + "☆".repeat(5 - e.rating) : "";

  return (
    <motion.div
      className="detail"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      onClick={(ev) => (ev.target as HTMLElement).classList.contains("detail") || (ev.target as HTMLElement).classList.contains("card") ? onClose() : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={e.title}
    >
      <button className="close" onClick={onClose}>Close ✕</button>
      <div className="card">
        <motion.div
          className="cover"
          style={{ "--c": e.color, "--ink-c": e.ink } as CSSProperties}
          initial={{ rotateY: -78, x: -50, opacity: 0 }}
          animate={{ rotateY: 0, x: 0, opacity: 1 }}
          exit={{ rotateY: -50, opacity: 0, transition: { duration: 0.25 } }}
          transition={{ type: "spring", stiffness: 70, damping: 15, mass: 1 }}
        >
          {e.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.posterUrl} alt={`${e.title} poster`} />
          ) : (
            <div className="ct">
              <span>{e.mediaType === "tv" ? "Series" : "Movie"}</span>
              <b>{e.title}</b>
              <span>{e.creator}<br />{e.year}</span>
            </div>
          )}
        </motion.div>

        <motion.div className="info" variants={stagger} initial="hidden" animate="show">
          <motion.div variants={rise} className="meta">
            {e.status === "want" ? "Want to watch · " : ""}{e.mediaType === "tv" ? "Series" : "Movie"}
            {e.seasons ? ` · ${e.seasons} season${e.seasons > 1 ? "s" : ""}` : ""}
            {e.year ? ` · ${e.year}` : ""}
          </motion.div>
          <motion.h2 variants={rise}>{e.title}</motion.h2>
          <motion.div variants={rise} className="by">
            {[e.creator, e.genres.join(" / ")].filter(Boolean).join(" · ")}
          </motion.div>
          {stars ? <motion.div variants={rise} className="stars">{stars}</motion.div> : null}
          {e.liked ? (<><motion.h4 variants={rise}>What I liked</motion.h4><motion.p variants={rise}>{e.liked}</motion.p></>) : null}
          {e.learned ? (<><motion.h4 variants={rise}>What I learned</motion.h4><motion.p variants={rise}>{e.learned}</motion.p></>) : null}
          {e.watchedOn ? (<><motion.h4 variants={rise}>Watched</motion.h4><motion.p variants={rise} className="small">{fmtDate(e.watchedOn)}</motion.p></>) : null}
          {e.status !== "want" && !e.liked && !e.learned ? <motion.p variants={rise} className="soft" style={{ marginTop: 18 }}>{onEdit ? "No notes yet. Add what you liked and what you learned." : "No notes yet."}</motion.p> : null}

          {(onEdit || onDelete) && (
            <motion.div variants={rise} className="row" style={{ marginTop: 28 }}>
              {onWatched && e.status === "want" && <button className="btn small" onClick={() => onWatched(e)}>✓ I’ve watched it</button>}
              {onEdit && <button className="btn ghost small" onClick={() => onEdit(e)}>{e.status === "want" ? "Edit" : "Edit notes"}</button>}
              {onDelete && !confirming && <button className="btn danger small" onClick={() => setConfirming(true)}>Remove</button>}
              {onDelete && confirming && (
                <>
                  <button
                    className="btn danger small"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try { await onDelete(e); } finally { setBusy(false); }
                    }}
                  >
                    {busy ? "Removing…" : "Yes, remove it"}
                  </button>
                  <button className="btn ghost small" onClick={() => setConfirming(false)}>Keep</button>
                </>
              )}
            </motion.div>
          )}

          {recs.length > 0 && (
            <motion.div variants={rise} className="recs">
              <h4>If you liked this</h4>
              <div className="recrow">
                {recs.map((r) => {
                  const k = entryKey(r);
                  const done = added.has(k);
                  return (
                    <motion.button
                      key={k}
                      type="button"
                      className={`rec${done ? " done" : ""}`}
                      title={onAddRec ? `${r.title}: add to want to watch` : r.title}
                      aria-label={onAddRec ? `Add ${r.title} to want to watch` : r.title}
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.94 }}
                      disabled={!onAddRec || done}
                      onClick={async () => {
                        if (!onAddRec) return;
                        setAdded((p) => new Set(p).add(k));
                        try { await onAddRec(r, "want"); } catch { setAdded((p) => { const n = new Set(p); n.delete(k); return n; }); }
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r.thumb ? <img src={r.thumb} alt="" loading="lazy" /> : <span className="ph" />}
                      <span className="plus">{done ? "✓" : onAddRec ? "+" : ""}</span>
                    </motion.button>
                  );
                })}
              </div>
              {onAddRec && <p className="note" style={{ marginTop: 8 }}>Tap one to add it to your want-to-watch list.</p>}
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
