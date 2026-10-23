"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useShelf } from "@/lib/useShelf";
import { SAMPLE_ENTRIES } from "@/lib/sample";
import LibraryView from "./LibraryView";
import AuthModal from "./AuthModal";
import SettingsModal from "./SettingsModal";
import PublicShelf from "./PublicShelf";
import { useRepairPosters } from "@/lib/repair";

/** The shelf shown to visitors on the home page (set NEXT_PUBLIC_FEATURED_USERNAME). */
const FEATURED = process.env.NEXT_PUBLIC_FEATURED_USERNAME?.trim().toLowerCase() || null;

export default function Home() {
  const s = useShelf();
  const [auth, setAuth] = useState<null | "in" | "up">(null);
  const [justStarted, setJustStarted] = useState(false);
  const [settings, setSettings] = useState(false);
  useRepairPosters(s.ready, s.entries, s.update);

  // a brand-new account gets the "seen any of these?" picker once
  const picksKey = s.user ? `shelf.picks.seen:${s.user.id}` : null;
  const [picksSeen, setPicksSeen] = useState<boolean | null>(null);
  useEffect(() => {
    if (!picksKey) return;
    try {
      setPicksSeen(localStorage.getItem(picksKey) === "1");
    } catch {
      setPicksSeen(true);
    }
  }, [picksKey]);
  useEffect(() => {
    if (picksKey && picksSeen === false && s.ready) {
      try {
        localStorage.setItem(picksKey, "1");
      } catch {
        /* ignore */
      }
    }
  }, [picksKey, picksSeen, s.ready]);

  if (!s.ready || (s.user && picksSeen === null)) return <div className="boot">shelf.</div>;

  const authModal = (
    <AnimatePresence>
      {auth && <AuthModal initialMode={auth} onClose={() => setAuth(null)} onSignIn={s.signIn} onSignUp={s.signUp} />}
    </AnimatePresence>
  );

  // ---------- visitors: the featured shelf, with "Make your own" ----------
  if (s.backend && !s.user && FEATURED) return <PublicShelf username={FEATURED} />;

  // ---------- no featured shelf configured (or demo mode): a sample shelf and an invitation ----------
  if (!s.user && !s.started && s.entries.length === 0) {
    return (
      <>
        <LibraryView
          key="landing"
          eyebrow="Your watchlist, as a library"
          heading="Every film you love, on one shelf."
          lede="Search any movie or series, add it in a click, and watch your own 3D library fill up. Share it with a link."
          entries={SAMPLE_ENTRIES}
          topRight={s.backend ? <button className="btn ghost small" onClick={() => setAuth("in")}>Sign in</button> : undefined}
          heroExtra={
            <div className="row">
              <motion.button
                className="btn"
                onClick={() => (s.backend ? setAuth("up") : (setJustStarted(true), s.start()))}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
              >
                {s.backend ? "Make your own" : "Start your shelf"}
              </motion.button>
              <span className="who">{s.backend ? "Free · takes a minute" : "Free · no account needed to begin"}</span>
            </div>
          }
        />
        {authModal}
      </>
    );
  }

  // ---------- your own shelf ----------
  const username = s.profile?.username;
  const displayName = s.profile?.displayName;
  const name = displayName || username;
  return (
    <>
      <LibraryView
        key="shelf"
        eyebrow={s.user ? `@${username ?? "you"}` : "A film & series diary"}
        heading={name ? `${name}’s watchlist` : "Welcome to my watchlist"}
        statsName={name}
        entries={s.entries}
        startWithPicks={justStarted || (!!s.user && picksSeen === false && s.entries.length === 0)}
        banner={
          !s.backend ? (
            <div className="banner">
              Demo mode: your shelf is saved only in this browser. Connect Supabase to enable accounts and shareable public pages.
            </div>
          ) : s.error ? (
            <div className="banner">{s.error}</div>
          ) : undefined
        }
        menuItems={
          s.user
            ? [
                ...(username ? [{ key: "public", label: "View public page", href: `/u/${username}` }] : []),
                { key: "settings", label: "Settings", onClick: () => setSettings(true) },
                { key: "signout", label: "Sign out", onClick: () => s.signOut() },
              ]
            : undefined
        }
        owner={{
          onAdd: s.add,
          onUpdate: s.update,
          onRemove: s.remove,
          shareUrl: s.user && username && typeof window !== "undefined" ? `${window.location.origin}/u/${username}` : undefined,
        }}
      />
      {authModal}
      <AnimatePresence>
        {settings && s.profile && (
          <SettingsModal profile={s.profile} email={s.user?.email} onSave={s.saveProfile} onChangePassword={s.changePassword} onClose={() => setSettings(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
