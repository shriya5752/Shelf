"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Draft, Entry, SearchResult, Status, TitleDetails } from "@/lib/types";
import { entryKey } from "@/lib/types";
import { extractColors, fallbackColors } from "@/lib/spine";

type Props = {
  editing: Entry | null;
  initialQuery?: string;
  /** which list a new title goes to (the one you're looking at); also used to move a want-to-watch title to watched */
  initialStatus?: Status;
  existing: Set<string>;
  onClose: () => void;
  onSave: (d: Draft, editingId?: string) => Promise<void>;
};

const slide = {
  initial: (dir: number) => ({ opacity: 0, x: 40 * dir }),
  animate: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: -40 * dir }),
};

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="stars-input" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <motion.button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={`star${n <= value ? " on" : ""}`}
          whileHover={{ scale: 1.18, rotate: -6 }}
          whileTap={{ scale: 0.85 }}
          onClick={() => onChange(value === n ? 0 : n)}
        >
          ★
        </motion.button>
      ))}
    </div>
  );
}

export default function AddModal({ editing, initialQuery, initialStatus, existing, onClose, onSave }: Props) {
  const [step, setStep] = useState<"search" | "custom" | "details">(editing ? "details" : "search");
  const [dir, setDir] = useState(1);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [details, setDetails] = useState<TitleDetails | null>(null);
  const [detailsError, setDetailsError] = useState(false);
  const [rating, setRating] = useState(editing?.rating ?? 0);
  const [status, setStatus] = useState<Status>(initialStatus ?? editing?.status ?? "watched");
  const [watchedOn, setWatchedOn] = useState(editing?.watchedOn || (editing && editing.status === "want" && initialStatus === "watched" ? new Date().toISOString().slice(0, 10) : ""));
  const [liked, setLiked] = useState(editing?.liked ?? "");
  const [learned, setLearned] = useState(editing?.learned ?? "");
  const [cTitle, setCTitle] = useState("");
  const [cType, setCType] = useState<"movie" | "tv">("movie");
  const [cYear, setCYear] = useState("");
  const [cCreator, setCCreator] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (step === "search") inputRef.current?.focus();
  }, [step]);

  // live search, debounced
  useEffect(() => {
    if (step !== "search") return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const ac = new AbortController();
    const t = setTimeout(async () => {
      // one quiet retry, so a brief hiccup (server restarting, flaky wifi) doesn't surface as an error
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ac.signal });
          const j = (await r.json()) as { results?: SearchResult[]; error?: string };
          setResults(j.results ?? []);
          setError(j.error ?? null);
          break;
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
          if (attempt === 1) {
            setResults([]); // never leave results from an older search next to an error
            setError("Couldn’t reach search. Check your connection and try again.");
          } else {
            await new Promise((res) => setTimeout(res, 900));
            if (ac.signal.aborted) return;
          }
        }
      }
      if (!ac.signal.aborted) setLoading(false);
    }, 280);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [query, step]);

  async function choose(r: SearchResult) {
    setPicked(r);
    setDetails(null);
    setDetailsError(false);
    setDir(1);
    setStep("details");
    try {
      const qs = new URLSearchParams({ source: r.source, type: r.mediaType, id: String(r.externalId) });
      const res = await fetch(`/api/title?${qs}`);
      if (!res.ok) throw new Error();
      setDetails((await res.json()) as TitleDetails);
    } catch {
      // still saveable with just the basics
      setDetailsError(true);
      setDetails({ creator: "", genres: [], seasons: null, year: r.year, poster: r.poster });
    }
  }

  /** search couldn't find it: add it by hand (no poster; the spine gets its own colour) */
  function chooseCustom() {
    const y = /^\d{4}$/.test(cYear.trim()) ? Number(cYear.trim()) : null;
    const t = cTitle.trim();
    const r: SearchResult = { source: "custom", externalId: Date.now() * 1000 + Math.floor(Math.random() * 1000), mediaType: cType, title: t, year: y, thumb: null, poster: null };
    setPicked(r);
    setDetails({ creator: cCreator.trim(), genres: [], seasons: null, year: y, poster: null });
    setDetailsError(false);
    setDir(1);
    setStep("details");
  }

  const title = editing?.title ?? picked?.title ?? "";
  const thumb = editing?.posterUrl ?? picked?.thumb ?? null;

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      if (editing) {
        await onSave(
          status === "want"
            ? { ...editing, status, rating: 0, watchedOn: "", liked: "", learned: "" }
            : { ...editing, status, rating, watchedOn, liked: liked.trim(), learned: learned.trim() },
          editing.id,
        );
      } else if (picked && details) {
        const posterUrl = details.poster ?? picked.poster;
        const colors = (await extractColors(posterUrl)) ?? fallbackColors(picked.title);
        await onSave({
          source: picked.source, externalId: picked.externalId, mediaType: picked.mediaType, title: picked.title,
          year: details.year ?? picked.year, creator: details.creator, genres: details.genres, posterUrl,
          color: colors.color, ink: colors.ink, seasons: details.seasons, status,
          rating: status === "want" ? 0 : rating, watchedOn: status === "want" ? "" : watchedOn,
          liked: status === "want" ? "" : liked.trim(), learned: status === "want" ? "" : learned.trim(),
        });
      }
    } catch (err) {
      setSaveError(err instanceof Error && /duplicate|unique/i.test(err.message) ? "That’s already on your shelf or list." : "Couldn't save. Please try again.");
      setSaving(false);
    }
  }

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
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit notes" : "Add a title"}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        <div className="sheet-head">
          <h2>{editing ? (initialStatus === "watched" && editing.status === "want" ? "You watched it!" : "Edit") : step === "search" ? (status === "want" ? "Add to want to watch" : "Add to your shelf") : step === "custom" ? "Add it yourself" : "Your notes"}</h2>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="sheet-body">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            {step === "search" ? (
              <motion.div key="search" custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
                <input
                  ref={inputRef}
                  className="big-input"
                  placeholder="Search any movie or series…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search movies and series"
                />
                {loading && <p className="hint"><span className="spinner" />Searching…</p>}
                {error && <p className="hint err">{error}</p>}
                {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
                  <p className="hint">Nothing found for “{query.trim()}”. Try the full title.</p>
                )}
                {query.trim().length < 2 && !loading && <p className="hint">Start typing a title. Try “Inception” or “Gilmore Girls”.</p>}
                <ul className="results">
                  <AnimatePresence initial={false}>
                    {results.map((r, i) => {
                      const on = existing.has(entryKey(r));
                      return (
                        <motion.li
                          key={`${r.source}:${r.mediaType}:${r.externalId}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: i * 0.04, type: "spring", stiffness: 260, damping: 24 }}
                        >
                          <button className="result" disabled={on} onClick={() => choose(r)}>
                            {r.thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.thumb} alt="" />
                            ) : (
                              <div className="ph" />
                            )}
                            <span>
                              <b>{r.title}</b>
                              <small>
                                {r.mediaType === "tv" ? "Series" : "Movie"}
                                {r.year ? ` · ${r.year}` : ""}
                                {on ? " · On your shelf" : ""}
                              </small>
                            </span>
                          </button>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
                {query.trim().length >= 2 && !loading && (
                  <p className="hint cant">
                    Didn’t find what you’re looking for?{" "}
                    <button type="button" className="linkbtn" onClick={() => { setCTitle((t) => t || query.trim()); setDir(1); setStep("custom"); }}>
                      Don’t worry, add it here
                    </button>
                  </p>
                )}
              </motion.div>
            ) : step === "custom" ? (
              <motion.div key="custom" custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
                <p className="hint" style={{ marginTop: 0 }}>No problem. Tell me about it and it goes on your shelf with its own spine (there’s no poster for titles added by hand).</p>
                <div className="seg" role="tablist" aria-label="Movie or series">
                  {(["movie", "tv"] as const).map((t) => (
                    <button key={t} type="button" role="tab" aria-selected={cType === t} className={`segbtn${cType === t ? " on" : ""}`} onClick={() => setCType(t)}>
                      {cType === t && <motion.span layoutId="ctpill" className="bg" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                      <span>{t === "movie" ? "Movie" : "Series"}</span>
                    </button>
                  ))}
                </div>
                <label className="field">
                  <span>Title</span>
                  <input value={cTitle} maxLength={300} onChange={(e) => setCTitle(e.target.value)} placeholder="Exactly as you’d like it on the spine" autoFocus />
                </label>
                <label className="field">
                  <span>Year (optional)</span>
                  <input inputMode="numeric" maxLength={4} value={cYear} onChange={(e) => setCYear(e.target.value.replace(/\D/g, ""))} placeholder="2019" />
                </label>
                <label className="field">
                  <span>{cType === "tv" ? "Creator" : "Director"} (optional)</span>
                  <input value={cCreator} maxLength={300} onChange={(e) => setCCreator(e.target.value)} />
                </label>
                <div className="foot">
                  <button className="btn ghost small" onClick={() => { setDir(-1); setStep("search"); }}>← Back to search</button>
                  <button className="btn" disabled={!cTitle.trim()} onClick={chooseCustom}>Continue</button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="details" custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
                <div className="picked">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" />
                  ) : (
                    <div className="ph" />
                  )}
                  <div>
                    <b>{title}</b>
                    <small>
                      {!editing && !details ? (<><span className="spinner" />Loading details…</>) : (
                        [(editing?.mediaType ?? picked?.mediaType) === "tv" ? "Series" : "Movie", details?.year ?? editing?.year ?? picked?.year, details?.creator ?? editing?.creator].filter(Boolean).join(" · ")
                      )}
                    </small>
                  </div>
                </div>

                <div className="seg" role="tablist" aria-label="Which list">
                  {(["watched", "want"] as const).map((st) => (
                    <button key={st} type="button" role="tab" aria-selected={status === st} className={`segbtn${status === st ? " on" : ""}`} onClick={() => setStatus(st)}>
                      {status === st && <motion.span layoutId="segpill" className="bg" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                      <span>{st === "watched" ? "I’ve watched it" : "Want to watch"}</span>
                    </button>
                  ))}
                </div>
                <AnimatePresence initial={false}>
                  {status === "watched" && (
                    <motion.div key="notes" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                      <div className="field">
                        <span>Your rating</span>
                        <Stars value={rating} onChange={setRating} />
                      </div>
                      <label className="field">
                        <span>When did you watch it?</span>
                        <input type="date" value={watchedOn.length === 10 ? watchedOn : ""} onChange={(e) => setWatchedOn(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
                      </label>
                      <label className="field">
                        <span>What I liked</span>
                        <textarea rows={2} maxLength={2000} value={liked} onChange={(e) => setLiked(e.target.value)} placeholder="The ending, the soundtrack, that one scene…" />
                      </label>
                      <label className="field">
                        <span>What I learned</span>
                        <textarea rows={2} maxLength={2000} value={learned} onChange={(e) => setLearned(e.target.value)} placeholder="A lesson, a feeling, something that stayed with you…" />
                      </label>
                    </motion.div>
                  )}
                </AnimatePresence>

                {detailsError && <p className="note">Couldn’t fetch extra details, but you can still add it.</p>}
                {saveError && <p className="hint err">{saveError}</p>}
                <div className="foot">
                  {editing ? <span /> : (
                    <button className="btn ghost small" onClick={() => { setDir(-1); setStep(picked?.source === "custom" ? "custom" : "search"); }}>← Back</button>
                  )}
                  <button className="btn" disabled={saving || (!editing && !details)} onClick={save}>
                    {saving ? "Saving…" : editing ? "Save" : status === "want" ? "Add to my list" : "Add to shelf"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
