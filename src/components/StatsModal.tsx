"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Entry } from "@/lib/types";
import { forYear, monthCounts, summarise, type Summary } from "@/lib/stats";

type Props = { entries: Entry[]; ownerName?: string; onClose: () => void };

const rise = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 180, damping: 22 } } };
const list = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } };

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <motion.div variants={rise} className="stat">
      <b>{value}</b>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </motion.div>
  );
}

function HBars({ rows }: { rows: { name: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="hbars">
      {rows.map((r, i) => (
        <div key={r.name} className="hbar">
          <span>{r.name}</span>
          <div className="track">
            <motion.i initial={{ width: 0 }} animate={{ width: `${(r.count / max) * 100}%` }} transition={{ delay: 0.1 + i * 0.05, type: "spring", stiffness: 90, damping: 18 }} />
          </div>
          <em>{r.count}</em>
        </div>
      ))}
    </div>
  );
}

function VBars({ rows, onPick, active }: { rows: { label: string; count: number }[]; onPick?: (l: string) => void; active?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="vbars">
      {rows.map((r, i) => (
        <button key={r.label} type="button" className={`vbar${active === r.label ? " on" : ""}`} onClick={() => onPick?.(r.label)} disabled={!onPick} aria-label={`${r.label}: ${r.count}`}>
          <div className="col">
            <motion.i initial={{ height: 0 }} animate={{ height: `${(r.count / max) * 100}%` }} transition={{ delay: 0.1 + i * 0.04, type: "spring", stiffness: 90, damping: 18 }} />
          </div>
          <em>{r.count || ""}</em>
          <span>{r.label}</span>
        </button>
      ))}
    </div>
  );
}

function Poster({ e }: { e: Entry }) {
  return e.posterUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={e.posterUrl} alt="" className="mini" />
  ) : (
    <span className="mini" style={{ background: e.color }} />
  );
}

function Best({ items }: { items: Entry[] }) {
  if (!items.length) return null;
  return (
    <motion.div variants={rise}>
      <h4 className="sh">Highest rated</h4>
      <div className="bestrow">
        {items.map((e) => (
          <div key={e.id} className="best">
            <Poster e={e} />
            <div>
              <b>{e.title}</b>
              <small>{"★".repeat(e.rating)}{e.year ? ` · ${e.year}` : ""}</small>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function Overview({ s, all }: { s: Summary; all: boolean }) {
  return (
    <motion.div variants={list} initial="hidden" animate="show">
      <div className="stats-grid">
        <Tile label="Titles" value={s.total} />
        <Tile label="Movies" value={s.movies} />
        <Tile label="Series" value={s.series} sub={s.seasons ? `${s.seasons} seasons` : undefined} />
        <Tile label="Avg rating" value={s.avgRating ? s.avgRating.toFixed(1) : "–"} sub={s.rated ? `${s.rated} rated` : "none rated yet"} />
      </div>
      {s.genres.length > 0 && (<motion.div variants={rise}><h4 className="sh">Favourite genres</h4><HBars rows={s.genres.slice(0, 6)} /></motion.div>)}
      {all && s.byYear.length > 0 && (<motion.div variants={rise}><h4 className="sh">Watched per year</h4><VBars rows={s.byYear.map((y) => ({ label: y.year, count: y.count }))} />{s.undated > 0 && <p className="note">{s.undated} title{s.undated === 1 ? "" : "s"} without a watched date aren’t counted here.</p>}</motion.div>)}
      {s.creators.length > 0 && (<motion.div variants={rise}><h4 className="sh">Directors &amp; creators you return to</h4><HBars rows={s.creators.slice(0, 5)} /></motion.div>)}
      <Best items={s.best} />
    </motion.div>
  );
}

export default function StatsModal({ entries, ownerName, onClose }: Props) {
  const watched = useMemo(() => entries.filter((e) => e.status === "watched"), [entries]);
  const all = useMemo(() => summarise(watched), [watched]);
  const years = all.byYear.map((y) => y.year);
  const [tab, setTab] = useState<string>("all");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const yearList = useMemo(() => (tab === "all" ? [] : forYear(watched, tab)), [watched, tab]);
  const ys = useMemo(() => summarise(yearList), [yearList]);
  const months = useMemo(() => monthCounts(yearList), [yearList]);
  const topGenre = ys.genres[0];

  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="sheet wide"
        role="dialog"
        aria-modal="true"
        aria-label="Stats"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        <div className="sheet-head">
          <h2>{ownerName ? `${ownerName}’s numbers` : "Your numbers"}</h2>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="sheet-body">
          {watched.length === 0 ? (
            <p className="hint">Nothing watched yet. Add a few titles and your stats will appear here.</p>
          ) : (
            <>
              <div className="chips" role="tablist" aria-label="Period">
                {["all", ...[...years].reverse()].map((t) => (
                  <button key={t} role="tab" aria-selected={tab === t} className={`chip${tab === t ? " on" : ""}`} onClick={() => setTab(t)}>
                    {tab === t && <motion.span layoutId="statchip" className="bg" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                    <span>{t === "all" ? "All time" : t}</span>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {tab === "all" ? (
                  <motion.div key="all" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                    <Overview s={all} all />
                  </motion.div>
                ) : (
                  <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                    <motion.div variants={list} initial="hidden" animate="show">
                      <motion.div variants={rise} className="review">
                        <span className="big">{tab}</span>
                        <p>
                          You watched <b>{ys.total}</b> title{ys.total === 1 ? "" : "s"}
                          {ys.total > 0 && <> — {ys.movies} movie{ys.movies === 1 ? "" : "s"} and {ys.series} series</>}.
                          {topGenre && <> Your favourite genre was <b>{topGenre.name}</b>.</>}
                          {ys.busiestMonth && ys.busiestMonth.count > 1 && <> Busiest month: <b>{ys.busiestMonth.label.split(" ")[0]}</b> ({ys.busiestMonth.count}).</>}
                          {ys.avgRating && <> You averaged <b>{ys.avgRating.toFixed(1)} ★</b>.</>}
                        </p>
                        {ys.first && ys.last && ys.first.id !== ys.last.id && (
                          <small>Started the year with <i>{ys.first.title}</i>, and the latest was <i>{ys.last.title}</i>.</small>
                        )}
                      </motion.div>
                      <motion.div variants={rise}><h4 className="sh">By month</h4><VBars rows={months.map((m) => ({ label: m.month, count: m.count }))} /></motion.div>
                      {ys.genres.length > 0 && (<motion.div variants={rise}><h4 className="sh">Genres that year</h4><HBars rows={ys.genres.slice(0, 5)} /></motion.div>)}
                      <Best items={ys.best.slice(0, 4)} />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
