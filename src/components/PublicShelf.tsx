"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/useAuth";
import ProfileClient from "./ProfileClient";
import type { MenuItem } from "./Menu";
import AuthModal from "./AuthModal";

/**
 * Someone's shelf as a visitor sees it, with "Make your own" in the top bar.
 * Choosing it opens sign-up; once they're signed in they land on their own shelf.
 */
export default function PublicShelf({ username }: { username: string }) {
  const a = useAuth();
  const router = useRouter();
  const [auth, setAuth] = useState<null | "in" | "up">(null);
  const asked = useRef(false);

  const open = (mode: "in" | "up") => {
    asked.current = true;
    setAuth(mode);
  };

  // signed in from someone else's page -> go to your own shelf (on the home page it switches by itself)
  useEffect(() => {
    if (a.user && asked.current && window.location.pathname !== "/") router.push("/");
  }, [a.user, router]);

  const actions = !a.ready || !a.backend ? undefined : a.user ? (
    <Link className="btn small" href="/" style={{ textDecoration: "none" }}>My shelf</Link>
  ) : (
    <>
      <button className="btn ghost small hide-sm" onClick={() => open("in")}>Sign in</button>
      <button className="btn small" onClick={() => open("up")}>Make your own</button>
    </>
  );
  const menuItems: MenuItem[] | undefined = a.ready && a.backend && !a.user ? [{ key: "signin", label: "Sign in", mobileOnly: true, onClick: () => open("in") }] : undefined;

  return (
    <>
      <ProfileClient username={username} actions={actions} menuItems={menuItems} />
      <AnimatePresence>
        {auth && <AuthModal initialMode={auth} onClose={() => setAuth(null)} onSignIn={a.signIn} onSignUp={a.signUp} />}
      </AnimatePresence>
    </>
  );
}
