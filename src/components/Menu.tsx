"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type MenuItem = {
  key: string;
  label: string;
  onClick?: () => void;
  href?: string;
  /** only listed in the menu on phones (on desktop it has its own button in the top bar) */
  mobileOnly?: boolean;
  danger?: boolean;
};

export default function Menu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const desktopItems = items.some((i) => !i.mobileOnly);

  return (
    <div className={`menu${desktopItems ? "" : " phone-only"}`} ref={ref}>
      <button
        type="button"
        className="btn ghost small menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className="menu-pop"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            style={{ transformOrigin: "top right" }}
          >
            {items.map((i) =>
              i.href ? (
                <a key={i.key} role="menuitem" href={i.href} className={`menu-item${i.mobileOnly ? " m-only" : ""}`} onClick={() => setOpen(false)}>
                  {i.label}
                </a>
              ) : (
                <button
                  key={i.key}
                  type="button"
                  role="menuitem"
                  className={`menu-item${i.mobileOnly ? " m-only" : ""}${i.danger ? " danger" : ""}`}
                  onClick={() => {
                    setOpen(false);
                    i.onClick?.();
                  }}
                >
                  {i.label}
                </button>
              ),
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
