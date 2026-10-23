"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Draft, Entry, SearchResult, Status } from "@/lib/types";
import { entryKey } from "@/lib/types";
import { SORT_LABELS, fmtDate, matchesQuery, orderEntries, yearGroup, type SortDir, type SortKey } from "@/lib/format";
import Shelf from "./Shelf";
import Detail from "./Detail";
import AddModal from "./AddModal";
import PicksModal, { type PickAction } from "./PicksModal";
import SmartPicksModal from "./SmartPicksModal";
import SiteFooter from "./SiteFooter";
import StatsModal from "./StatsModal";
import ImportModal from "./ImportModal";
import Link from "next/link";
import Menu, { type MenuItem } from "./Menu";
import { draftFromResult } from "@/lib/draft";

type Props = {
  eyebrow: string;
  heading: string;
  lede?: string;
  entries: Entry[];
  /** present only when the viewer owns this shelf */
  owner?: {
    onAdd: (d: Draft) => Promise<Entry>;
    onUpdate: (id: string, d: Draft) => Promise<Entry>;
    onRemove: (id: string) => Promise<void>;
    shareUrl?: string;
  };
  topRight?: React.ReactNode;
  /** account items (view public page, settings, sign out...) that go into the top-bar menu */
  menuItems?: MenuItem[];
  banner?: React.ReactNode;
  emptyCta?: React.ReactNode;
  heroExtra?: React.ReactNode;
  /** open the 'seen any of these?' picker straight away (used right after someone starts a shelf) */
  startWithPicks?: boolean;
  /** name used in the stats title on someone else's shelf */
  statsName?: string;
};

const VIEW_KEY = "shelf.view.v1";

function TypedHeading({ text }: { text: string }) {
  // letters animate one by one, but are grouped per word so lines never break mid-word
  const words = useMemo(() => {
    const parts = text.split(" ");
    return parts.map((w, i) => ({ w, start: parts.slice(0, i).reduce((n, p) => n + p.length + 1, 0) }));
  }, [text]);
  return (
    <h1 className="title" aria-label={text}>
      <em aria-hidden>
        {words.map(({ w, start }, wi) => (
          <span key={`${text}-${wi}`} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
            {Array.from(w).map((c, i) => (
              <motion.span
                key={i}
                className="ch"
                initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.15 + (start + i) * 0.045, type: "spring", stiffness: 200, damping: 20 }}
              >
                {c}
              </motion.span>
            ))}
            {wi < words.length - 1 ? "\u00A0" : ""}
          </span>
        ))}
      </em>
      <span className="caret" aria-hidden />
    </h1>
  );
}

export default function LibraryView({ eyebrow, heading, lede, entries, owner, topRight, menuItems, banner, emptyCta, heroExtra, startWithPicks, statsName }: Props) {
  const [view, setView] = useState<Status>("watched");
  const [sortKey, setSortKey] = useState<SortKey>("watched");
  const [dir, setDir] = useState<SortDir>("asc");
  const [group, setGroup] = useState(false);

  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [picking, setPicking] = useState(!!startWithPicks && !!owner && entries.length === 0);
  const [recsOpen, setRecsOpen] = useState(false);
  const [smartOpen, setSmartOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false); // phones: the search box is tucked away until asked for
  const [moreOpen, setMoreOpen] = useState(false); // phones: filters + sort are tucked away until asked for
  const [statsOpen, setStatsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<Status | undefined>(undefined);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [centerId, setCenterId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // remember how this viewer likes their shelf ordered
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null") as { sortKey?: SortKey; dir?: SortDir; group?: boolean } | null;
      if (v?.sortKey && v.sortKey in SORT_LABELS) setSortKey(v.sortKey);
      if (v?.dir === "asc" || v?.dir === "desc") setDir(v.dir);
      if (typeof v?.group === "boolean") setGroup(v.group);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify({ sortKey, dir, group }));
    } catch {
      /* ignore */
    }
  }, [sortKey, dir, group]);

  const say = useCallback((t: string) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  // ---------- the two lists ----------
  const watchedCount = useMemo(() => entries.filter((e) => e.status === "watched").length, [entries]);
  const wantCount = entries.length - watchedCount;
  const showTabs = !!owner || wantCount > 0;
  const activeView: Status = showTabs ? view : "watched";
  const viewEntries = useMemo(() => entries.filter((e) => e.status === activeView), [entries, activeView]);

  // "date watched" means nothing on the want-to-watch list, so it falls back to "recently added"
  const effKey: SortKey = activeView === "want" && sortKey === "watched" ? "added" : sortKey;
  const effDir: SortDir = activeView === "want" && sortKey === "watched" ? "desc" : dir;
  const grouped = group && activeView === "watched";
  const ordered = useMemo(() => orderEntries(viewEntries, effKey, effDir, grouped), [viewEntries, effKey, effDir, grouped]);
  const groupLabels = useMemo(() => {
    if (!grouped) return undefined;
    const m = new Map<string, string>();
    let last = "";
    for (const e of ordered) {
      const g = yearGroup(e);
      if (g !== last) {
        m.set(e.id, g);
        last = g;
      }
    }
    return m;
  }, [ordered, grouped]);

  const cats = useMemo(() => {
    const g = new Set<string>();
    viewEntries.forEach((e) => e.genres.forEach((x) => g.add(x)));
    return ["All", "Movies", "Series", ...[...g].sort()];
  }, [viewEntries]);
  const activeCat = cats.includes(cat) ? cat : "All";

  const dimmed = useMemo(() => {
    const s = new Set<string>();
    for (const e of ordered) {
      const okCat =
        activeCat === "All" ||
        (activeCat === "Movies" && e.mediaType === "movie") ||
        (activeCat === "Series" && e.mediaType === "tv") ||
        e.genres.includes(activeCat);
      if (!okCat || !matchesQuery(e, query.trim())) s.add(e.id);
    }
    return s;
  }, [ordered, activeCat, query]);

  // when filters change, glide to the first match
  const firstMatch = useMemo(() => ordered.find((e) => !dimmed.has(e.id))?.id ?? null, [ordered, dimmed]);
  const lastFilterKey = useRef("All|");
  useEffect(() => {
    const key = `${activeCat}|${query}`;
    if (key === lastFilterKey.current) return;
    lastFilterKey.current = key;
    if (firstMatch) {
      setFocusId(firstMatch);
      setFocusNonce((n) => n + 1);
    }
  }, [activeCat, query, firstMatch]);

  const open = entries.find((e) => e.id === openId) ?? null;
  const editing = entries.find((e) => e.id === editingId) ?? null;
  const center = ordered.find((e) => e.id === centerId) ?? null;
  const existing = useMemo(() => new Set(entries.map(entryKey)), [entries]);

  // seeds for "recommended for you": your best-rated titles (then most recent) that TMDB knows
  const recSeeds = useMemo(() => {
    return entries
      .filter((e) => e.status === "watched" && e.source === "tmdb")
      .sort((a, b) => b.rating - a.rating || b.watchedOn.localeCompare(a.watchedOn) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6)
      .map((e) => `${e.mediaType}:${e.externalId}`);
  }, [entries]);

  async function handleSave(d: Draft, editId?: string) {
    if (!owner) return;
    if (editId) {
      await owner.onUpdate(editId, d);
      setEditingId(null);
      setEditStatus(undefined);
      if (d.status !== activeView) setView(d.status);
      say(d.status === "watched" ? "Saved" : "Saved to your list");
    } else {
      const e = await owner.onAdd(d);
      setAdding(false);
      setAddQuery("");
      setCat("All");
      setQuery("");
      setView(d.status);
      setFreshId(e.id);
      setFocusId(e.id);
      setFocusNonce((n) => n + 1);
      say(d.status === "want" ? `Added “${e.title}” to want to watch` : `Added “${e.title}”`);
      setTimeout(() => setFreshId((id) => (id === e.id ? null : id)), 4000);
    }
  }

  async function handlePicks(picks: SearchResult[], status: Status) {
    if (!owner || !picks.length) return;
    setPicking(false);
    setRecsOpen(false);
    setSmartOpen(false);
    setView(status);
    setCat("All");
    setQuery("");
    let last: Entry | null = null;
    let failed = 0;
    for (let i = 0; i < picks.length; i++) {
      say(`Adding ${i + 1} of ${picks.length}…`);
      try {
        const e = await owner.onAdd(await draftFromResult(picks[i], status));
        last = e;
        setFreshId(e.id);
        setFocusId(e.id);
        setFocusNonce((n) => n + 1);
      } catch {
        failed++;
      }
    }
    say(failed ? `Added ${picks.length - failed}, ${failed} couldn’t be saved` : `Added ${picks.length} title${picks.length === 1 ? "" : "s"}`);
    if (last) {
      const id = last.id;
      setTimeout(() => setFreshId((cur) => (cur === id ? null : cur)), 4000);
    }
  }

  const starterActions: PickAction[] =
    activeView === "want"
      ? [{ label: (n) => (n ? `Add ${n} to want to watch` : "Pick a few"), status: "want" }]
      : [{ label: (n) => (n ? `Add ${n} to my shelf` : "Pick a few"), status: "watched" }];

  const emptyDefault = !owner ? (
    <div><h3>Nothing here yet</h3></div>
  ) : activeView === "want" ? (
    <div>
      <h3>Your want-to-watch list is empty</h3>
      <p>Save things you’d like to see. Pick from what’s popular, or search for a title.</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <button className="btn" onClick={() => setPicking(true)}>Browse popular</button>
        <button className="btn ghost" onClick={() => setAdding(true)}>+ Search a title</button>
      </div>
    </div>
  ) : (
    <div>
      <h3>Your shelf is empty</h3>
      <p>Search any movie or series, or pick from what’s popular.</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <button className="btn" onClick={() => setPicking(true)}>Pick from popular</button>
        <button className="btn ghost" onClick={() => setAdding(true)}>+ Search a title</button>
      </div>
    </div>
  );

  const showSort = viewEntries.length > 1;

  // everything that isn't a main action lives in one menu (phones also get Stats and For you in here)
  const topItems: MenuItem[] = [
    ...(watchedCount > 0 ? [{ key: "stats", label: "Stats", mobileOnly: true, onClick: () => setStatsOpen(true) }] : []),
    ...(owner ? [{ key: "recs", label: "✦ For you", mobileOnly: true, onClick: () => setRecsOpen(true) }] : []),
    ...(owner ? [{ key: "browse", label: "Browse popular", mobileOnly: true, onClick: () => setPicking(true) }] : []),
    ...(owner ? [{ key: "smart", label: "🧪 Smart picks · experiment", onClick: () => setSmartOpen(true) }] : []),
    ...(owner ? [{ key: "import", label: "Import a list", onClick: () => setImporting(true) }] : []),
    ...(menuItems ?? []),
  ];

  return (
    <div className={`page${open ? " blurred" : ""}`}>
      <main className="page-content">
        <nav className="topbar" aria-label="Main">
          <Link className="brand" href="/">shelf<i>.</i></Link>
          <div className="top-actions">
            {watchedCount > 0 && (
              <button className="btn ghost small hide-sm" onClick={() => setStatsOpen(true)}>Stats</button>
            )}
            {owner && (
              <button className="btn ghost small hide-sm" onClick={() => setRecsOpen(true)}>✦ For you</button>
            )}
            {owner?.shareUrl && (
              <button
                className="btn ghost small"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(owner.shareUrl!);
                    say("Link copied");
                  } catch {
                    say(owner.shareUrl!);
                  }
                }}
              >
                Share
              </button>
            )}
            {topRight}
            {topItems.length > 0 && <Menu items={topItems} />}
          </div>
        </nav>
        {banner}
        <header className="hero">
          <div>
            <motion.div className="eyebrow" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>{eyebrow}</motion.div>
            <TypedHeading text={heading} />
            {lede && <motion.p className="lede" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>{lede}</motion.p>}
            <motion.div className="count" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
              <b>{watchedCount}</b> title{watchedCount === 1 ? "" : "s"} watched
              {wantCount > 0 && <> · <b>{wantCount}</b> to watch</>}
            </motion.div>
            {heroExtra && <motion.div style={{ marginTop: 22 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}>{heroExtra}</motion.div>}
          </div>

          <motion.div className="hr" data-more={moreOpen ? "open" : "closed"} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, type: "spring", stiffness: 120, damping: 20 }}>
            {showTabs && (
              <div className="seg" role="tablist" aria-label="Which list">
                {(["watched", "want"] as const).map((st) => (
                  <button key={st} role="tab" aria-selected={activeView === st} className={`segbtn${activeView === st ? " on" : ""}`} onClick={() => { setView(st); setCat("All"); setQuery(""); }}>
                    {activeView === st && <motion.span layoutId="viewseg" className="bg" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                    <span>{st === "watched" ? "Watched" : "Want to watch"}<em>{st === "watched" ? watchedCount : wantCount}</em></span>
                  </button>
                ))}
              </div>
            )}

            {viewEntries.length > 0 && (
              <>
                <div className="mbar">
                  <button type="button" className="btn ghost small" aria-expanded={searchOpen} onClick={() => setSearchOpen((o) => !o)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                    Search
                  </button>
                  <button type="button" className="btn ghost small" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
                    Filters &amp; sort <span aria-hidden style={{ display: "inline-block", transform: moreOpen ? "rotate(180deg)" : "none", transition: "transform .25s" }}>▾</span>
                  </button>
                </div>
                <div className={`search${searchOpen || query ? "" : " m-collapsed"}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a title, a feeling, a lesson…" aria-label="Search your shelf" />
                </div>
                <AnimatePresence>
                  {owner && query.trim().length >= 2 && (
                    <motion.button
                      key="searchall"
                      className="searchall"
                      initial={{ opacity: 0, y: -6, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -6, height: 0 }}
                      onClick={() => { setAddQuery(query.trim()); setAdding(true); }}
                    >
                      Not on your shelf? Search all movies &amp; series for “{query.trim()}” →
                    </motion.button>
                  )}
                </AnimatePresence>
                <div className="pills">
                  {cats.map((c) => (
                    <button key={c} className={`pill${activeCat === c ? " on" : ""}`} onClick={() => setCat(c)}>
                      {activeCat === c && <motion.span layoutId="pillbg" className="bg" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                      <span>{c}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {showSort && (
              <div className="sortrow">
                <label className="sel">
                  <span>Sort</span>
                  <select value={effKey} onChange={(e) => { setSortKey(e.target.value as SortKey); setDir(e.target.value === "rating" || e.target.value === "added" ? "desc" : "asc"); }} aria-label="Sort the shelf">
                    {(Object.keys(SORT_LABELS) as SortKey[])
                      .filter((k) => activeView === "watched" || k !== "watched")
                      .map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
                  </select>
                </label>
                <button className="mini-btn" onClick={() => setDir(effDir === "asc" ? "desc" : "asc")} aria-label={effDir === "asc" ? "Ascending" : "Descending"} title={effDir === "asc" ? "Ascending" : "Descending"}>
                  <motion.span animate={{ rotate: effDir === "asc" ? 0 : 180 }} style={{ display: "inline-block" }}>↑</motion.span>
                </button>
                {activeView === "watched" && (
                  <button className={`mini-btn text${group ? " on" : ""}`} aria-pressed={group} onClick={() => setGroup((g) => !g)}>
                    Group by year
                  </button>
                )}
              </div>
            )}

            <div className="row hide-sm">
              {owner && (
                <motion.button className="btn" onClick={() => setAdding(true)} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}>
                  + Add a title
                </motion.button>
              )}
              {owner && (
                <motion.button className="btn ghost" onClick={() => setPicking(true)} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}>
                  Browse popular
                </motion.button>
              )}
            </div>
          </motion.div>
        </header>

        <Shelf
          entries={ordered}
          dimmed={dimmed}
          freshId={freshId}
          focusId={focusId}
          focusNonce={focusNonce}
          groupLabels={groupLabels}
          onOpen={(e) => setOpenId(e.id)}
          onCenter={setCenterId}
          empty={emptyCta && activeView === "watched" ? emptyCta : emptyDefault}
        />
        <div className="now" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {center && (
              <motion.div
                key={`${center.id}-${center.status}`}
                className="now-inner"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
              >
                {center.status === "want" ? (
                  <>
                    <span className="lab">On your list</span>
                    <span className="d">since {fmtDate(center.createdAt.slice(0, 10))}</span>
                  </>
                ) : (
                  <>
                    <span className="lab">Watched</span>
                    {center.watchedOn ? <span className="d">{fmtDate(center.watchedOn)}</span> : <span className="none">date not added</span>}
                  </>
                )}
                <span className="tt">{center.title}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <SiteFooter />

      {owner && !open && !adding && !picking && !recsOpen && !smartOpen && !statsOpen && !importing && !editingId && (
        <motion.button
          type="button"
          className="fab"
          aria-label="Add a title"
          onClick={() => setAdding(true)}
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.6 }}
        >
          +
        </motion.button>
      )}

      <AnimatePresence>
        {open && (
          <Detail
            key={open.id}
            entry={open}
            existing={existing}
            onClose={() => setOpenId(null)}
            onEdit={owner ? (e) => { setOpenId(null); setEditStatus(undefined); setEditingId(e.id); } : undefined}
            onWatched={owner ? (e) => { setOpenId(null); setEditStatus("watched"); setEditingId(e.id); } : undefined}
            onDelete={owner ? async (e) => { await owner.onRemove(e.id); setOpenId(null); say(`Removed “${e.title}”`); } : undefined}
            onAddRec={owner ? async (r, st) => { await owner.onAdd(await draftFromResult(r, st)); say(`Added “${r.title}” to want to watch`); } : undefined}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {owner && (adding || editing) && (
          <AddModal
            key={editing?.id ?? "new"}
            editing={editing}
            initialQuery={addQuery}
            initialStatus={editing ? editStatus : activeView}
            existing={existing}
            onClose={() => { setAdding(false); setEditingId(null); setEditStatus(undefined); setAddQuery(""); }}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {owner && picking && (
          <PicksModal
            key={`picks-${activeView}`}
            existing={existing}
            heading={activeView === "want" ? "What looks good?" : "Seen any of these?"}
            blurb={activeView === "want" ? "Tap anything you’d like to watch and it goes on your list." : "Tap what you’ve watched to start your shelf. You can add dates and notes later, and search for anything else."}
            actions={starterActions}
            onClose={() => setPicking(false)}
            onConfirm={handlePicks}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {owner && recsOpen && (
          <PicksModal
            key="recs"
            existing={existing}
            endpoint={`/api/recommend?limit=30&seeds=${recSeeds.join(",")}`}
            heading="Recommended for you"
            blurb={recSeeds.length ? "Based on the titles you’ve rated highest and watched most recently." : "Add a few titles (and rate them) and recommendations will appear here."}
            emptyText="Nothing new to suggest right now. Rate a few more titles and check back."
            skipLabel="Close"
            actions={[
              { label: (n) => (n ? `Add ${n} to want to watch` : "Pick a few"), status: "want" },
              { label: (n) => (n ? `I’ve watched ${n}` : "Already seen"), status: "watched", ghost: true },
            ]}
            onClose={() => setRecsOpen(false)}
            onConfirm={handlePicks}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {owner && smartOpen && (
          <SmartPicksModal key="smart" entries={entries} existing={existing} onClose={() => setSmartOpen(false)} onConfirm={handlePicks} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {owner && importing && (
          <ImportModal
            key="import"
            existing={existing}
            defaultStatus={activeView}
            onAdd={owner.onAdd}
            onRemove={owner.onRemove}
            onClose={() => setImporting(false)}
            onDone={(n) => {
              setCat("All");
              setQuery("");
              if (n) say(`Imported ${n} title${n === 1 ? "" : "s"}`);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {statsOpen && <StatsModal key="stats" entries={entries} ownerName={owner ? undefined : statsName} onClose={() => setStatsOpen(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div className="toast" style={{ x: "-50%" }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ type: "spring", stiffness: 360, damping: 28 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
