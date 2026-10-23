"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Entry } from "@/lib/types";
import { spineLayout } from "@/lib/spine";
import { fmtDate } from "@/lib/format";

type Props = {
  entries: Entry[];
  dimmed: Set<string>;
  freshId: string | null;
  focusId: string | null;
  focusNonce: number;
  onOpen: (e: Entry) => void;
  onCenter: (id: string | null) => void;
  empty?: React.ReactNode;
  /** entry id -> label of the group that starts at that entry (draws a year divider before it) */
  groupLabels?: Map<string, string>;
};

export default function Shelf({ entries, dimmed, freshId, focusId, focusNonce, onOpen, onCenter, empty, groupLabels }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const target = useRef(0);
  const raf = useRef(0);
  const centerRef = useRef<string | null>(null);
  const drag = useRef({ down: false, moved: false, startX: 0, startLeft: 0, lastX: 0, lastT: 0, vx: 0 });
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState<{ e: Entry; x: number; y: number } | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------- 3D curve + "which book is in the middle" ----------
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const mid = box.left + box.width / 2;
    let best: string | null = null;
    let bd = Infinity;
    el.querySelectorAll<HTMLElement>("[data-spine]").forEach((n) => {
      const r = n.getBoundingClientRect();
      const c = r.left + r.width / 2 - mid;
      const d = c / (box.width / 2);
      const ry = -Math.sign(d) * (Math.max(0, Math.abs(d) - 0.3) / 0.7) * 16;
      n.style.setProperty("--ry", ry.toFixed(2) + "deg");
      if (n.dataset.dim !== "1" && Math.abs(c) < bd) {
        bd = Math.abs(c);
        best = n.dataset.id ?? null;
      }
    });
    if (best !== centerRef.current) {
      centerRef.current = best;
      onCenter(best);
    }
  }, [onCenter]);

  const scheduleUpdate = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(update);
  }, [update]);

  // ---------- smooth scrolling engine (wheel, keys, drag + momentum) ----------
  const anim = useRef(0);
  const tickRef = useRef<() => void>(() => {});
  const tick = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const d = target.current - el.scrollLeft;
    if (Math.abs(d) < 1) {
      anim.current = 0;
      return;
    }
    const before = el.scrollLeft;
    el.scrollLeft = before + Math.sign(d) * Math.max(1, Math.abs(d) * 0.13);
    if (el.scrollLeft === before) {
      // can't move any closer (edge of the shelf, or a sub-pixel gap): stop instead of looping forever
      target.current = el.scrollLeft;
      anim.current = 0;
      return;
    }
    anim.current = requestAnimationFrame(() => tickRef.current());
  }, []);
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const go = useCallback(
    (x: number, relative = false) => {
      const el = ref.current;
      if (!el) return;
      const base = relative ? (anim.current ? target.current : el.scrollLeft) : 0;
      const max = el.scrollWidth - el.clientWidth;
      target.current = Math.max(0, Math.min(max, base + x));
      if (!anim.current) anim.current = requestAnimationFrame(tick);
    },
    [tick],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      go(Math.abs(ev.deltaY) > Math.abs(ev.deltaX) ? ev.deltaY : ev.deltaX, true);
    };
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      if (document.querySelector(".overlay, .detail")) return;
      if (ev.key === "ArrowRight") go(260, true);
      if (ev.key === "ArrowLeft") go(-260, true);
    };
    const onMove = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d.down) return;
      const dx = ev.clientX - d.startX;
      if (Math.abs(dx) > 5 && !d.moved) {
        d.moved = true;
        setDragging(true);
        setHover(null);
      }
      if (d.moved) {
        el.scrollLeft = d.startLeft - dx;
        target.current = el.scrollLeft;
        const now = performance.now();
        const dt = Math.max(1, now - d.lastT);
        d.vx = 0.8 * d.vx + 0.2 * ((ev.clientX - d.lastX) / dt);
        d.lastX = ev.clientX;
        d.lastT = now;
      }
    };
    const onUp = () => {
      const d = drag.current;
      if (!d.down) return;
      d.down = false;
      if (d.moved) {
        setDragging(false);
        go(-d.vx * 320, true); // glide on after release
        setTimeout(() => (d.moved = false), 0);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", scheduleUpdate);
      cancelAnimationFrame(anim.current);
    };
  }, [go, scheduleUpdate]);

  // recompute the curve/center after entries or filters change (layout animations settle)
  useEffect(() => {
    scheduleUpdate();
    const t = setTimeout(update, 450);
    return () => clearTimeout(t);
  }, [entries, dimmed, scheduleUpdate, update]);

  // bring a title to the middle (used after adding one, or when filtering)
  useEffect(() => {
    if (!focusId) return;
    const t = setTimeout(() => {
      const el = ref.current;
      const node = el?.querySelector<HTMLElement>(`[data-slot="${CSS.escape(focusId)}"]`);
      if (!el || !node) return;
      go(node.offsetLeft + node.offsetWidth / 2 - el.clientWidth / 2);
    }, 160);
    return () => clearTimeout(t);
  }, [focusId, focusNonce, go]);

  // start centred on the middle of the shelf
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !entries.length) return;
    started.current = true;
    const el = ref.current;
    if (el) requestAnimationFrame(() => go((el.scrollWidth - el.clientWidth) / 2));
  }, [entries.length, go]);

  const showTip = (e: Entry, node: HTMLElement) => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    if (drag.current.moved) return;
    const r = node.getBoundingClientRect();
    setHover({ e, x: r.left + r.width / 2, y: r.top });
  };
  const hideTip = () => {
    leaveTimer.current = setTimeout(() => setHover(null), 90);
  };

  return (
    <>
    <div className="shelf-wrap">
      <motion.div
        ref={ref}
        layoutScroll
        className={`shelf${dragging ? " drag" : ""}`}
        onScroll={() => {
          if (!anim.current && ref.current) target.current = ref.current.scrollLeft; // keep the glide target in step with native scrolling
          scheduleUpdate();
        }}
        onTouchStart={() => {
          cancelAnimationFrame(anim.current);
          anim.current = 0;
          if (ref.current) target.current = ref.current.scrollLeft;
        }}
        onPointerDown={(ev) => {
          cancelAnimationFrame(anim.current);
          anim.current = 0;
          if (ref.current) target.current = ref.current.scrollLeft;
          if (ev.pointerType === "touch") return; // touch uses native scrolling
          drag.current = { down: true, moved: false, startX: ev.clientX, startLeft: ref.current!.scrollLeft, lastX: ev.clientX, lastT: performance.now(), vx: 0 };
        }}
        onClickCapture={(ev) => {
          if (drag.current.moved) {
            ev.stopPropagation();
            ev.preventDefault();
          }
        }}
      >
        <AnimatePresence initial>
          {entries.flatMap((e, i) => {
            const out: React.ReactNode[] = [];
            const label = groupLabels?.get(e.id);
            if (label) {
              out.push(
                <motion.div
                  key={`g-${e.id}`}
                  className="divider"
                  layout="position"
                  aria-hidden
                  initial={{ opacity: 0, y: -80 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -40, transition: { duration: 0.25 } }}
                  transition={{ type: "spring", stiffness: 140, damping: 18, delay: Math.min(i, 22) * 0.045, layout: { type: "spring", stiffness: 170, damping: 24 } }}
                >
                  <span>{label}</span>
                </motion.div>,
              );
            }
            const L = spineLayout(e);
            const dim = dimmed.has(e.id);
            const style: CSSProperties = {
              width: L.width,
              height: `${L.heightPct}%`,
              marginLeft: L.marginLeft,
              marginRight: L.leaner ? -3 : 0,
              zIndex: L.leaner ? 2 : 1,
            };
            out.push(
              <motion.div
                key={e.id}
                data-slot={e.id}
                className="slot"
                style={style}
                layout="position"
                initial={{ y: -520, opacity: 0, rotate: -6 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                exit={{ y: -320, opacity: 0, transition: { duration: 0.35 } }}
                transition={{
                  type: "spring", stiffness: 120, damping: 15, mass: 0.9,
                  delay: e.id === freshId ? 0.05 : Math.min(i, 22) * 0.045,
                  layout: { type: "spring", stiffness: 170, damping: 24 },
                }}
              >
                <button
                  data-spine
                  data-id={e.id}
                  data-dim={dim ? "1" : "0"}
                  type="button"
                  aria-label={`${e.title}${e.year ? ` (${e.year})` : ""}`}
                  className={`spine${e.mediaType === "tv" ? " series" : ""}${dim ? " dim" : ""}${e.id === freshId ? " fresh" : ""}`}
                  style={{ "--c": e.color, "--ink-c": e.ink, "--lean": `${L.lean.toFixed(2)}deg` } as CSSProperties}
                  onClick={() => onOpen(e)}
                  onMouseEnter={(ev) => showTip(e, ev.currentTarget)}
                  onMouseLeave={hideTip}
                  onFocus={(ev) => showTip(e, ev.currentTarget)}
                  onBlur={hideTip}
                >
                  <div className="body">
                    <div className="cap" />
                    <div className="t">{e.title}</div>
                    <div className="y">{e.year ? `’${String(e.year).slice(2)}` : ""}</div>
                  </div>
                </button>
              </motion.div>,
            );
            return out;
          })}
        </AnimatePresence>
      </motion.div>
      <div className="plank" />
      {!entries.length && empty ? <div className="empty">{empty}</div> : null}
    </div>

      <AnimatePresence>
        {hover && (
          <motion.div
            key={hover.e.id}
            className="tip"
            style={{ left: Math.max(12, Math.min((typeof window !== "undefined" ? window.innerWidth : 1200) - 372, hover.x - 150)), top: Math.max(12, hover.y - 168) }}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            {hover.e.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hover.e.posterUrl} alt="" />
            ) : null}
            <div>
              <h3>{hover.e.title}</h3>
              {hover.e.creator ? <div className="meta">{hover.e.creator}</div> : null}
              <div className="meta m">
                {hover.e.year ?? ""} · {hover.e.mediaType === "tv" ? "Series" : "Movie"}
                {hover.e.seasons ? ` · ${hover.e.seasons} season${hover.e.seasons > 1 ? "s" : ""}` : ""}
              </div>
              {hover.e.genres.length ? <div className="meta m">{hover.e.genres.join(" / ")}</div> : null}
              {hover.e.status === "want" ? <div className="meta">On your want-to-watch list</div> : hover.e.watchedOn ? <div className="meta">Watched · {fmtDate(hover.e.watchedOn)}</div> : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
