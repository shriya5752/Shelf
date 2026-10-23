"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AuthResult } from "@/lib/useShelf";

type Props = {
  initialMode?: "in" | "up";
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<AuthResult>;
  onSignUp: (email: string, password: string, username: string) => Promise<AuthResult>;
};

export default function AuthModal({ initialMode = "up", onClose, onSignIn, onSignUp }: Props) {
  const [mode, setMode] = useState<"in" | "up">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const uname = username.trim().toLowerCase();
    if (mode === "up" && !/^[a-z0-9_]{3,20}$/.test(uname)) {
      setMessage({ kind: "err", text: "Pick a username with 3–20 letters, numbers or underscores." });
      return;
    }
    if (password.length < 8) {
      setMessage({ kind: "err", text: "Use a password with at least 8 characters." });
      return;
    }
    setBusy(true);
    const res = mode === "in" ? await onSignIn(email.trim(), password) : await onSignUp(email.trim(), password, uname);
    setBusy(false);
    if (!res.ok) return setMessage({ kind: "err", text: res.message });
    if (res.needsConfirm) return setMessage({ kind: "ok", text: "Almost there. Check your email and click the link to confirm your account." });
    onClose();
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
        style={{ width: "min(440px, 100%)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Sign in or create an account"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        <div className="sheet-head">
          <h2>{mode === "up" ? "Start your shelf" : "Welcome back"}</h2>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form className="sheet-body" onSubmit={submit}>
          <div className="tabs">
            {(["up", "in"] as const).map((m) => (
              <button type="button" key={m} className={`tab${mode === m ? " on" : ""}`} onClick={() => { setMode(m); setMessage(null); }}>
                {m === "up" ? "Create account" : "Sign in"}
                {mode === m && <motion.span layoutId="authtab" className="bg" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              </button>
            ))}
          </div>

          <AnimatePresence initial={false}>
            {mode === "up" && (
              <motion.label
                key="u"
                className="field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: "hidden" }}
              >
                <span>Username (your public link)</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="shriya" autoComplete="username" maxLength={20} />
              </motion.label>
            )}
          </AnimatePresence>
          <label className="field">
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "up" ? "new-password" : "current-password"} />
            {mode === "up" && <small className="note" style={{ display: "block", marginTop: 6 }}>At least 8 characters. Keep it safe: there’s no password reset yet.</small>}
          </label>

          <AnimatePresence>
            {message && (
              <motion.p key={message.text} className={`hint${message.kind === "err" ? " err" : ""}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {message.text}
              </motion.p>
            )}
          </AnimatePresence>
          <div className="foot">
            <span />
            <button className="btn" disabled={busy}>{busy ? "One moment…" : mode === "up" ? "Create account" : "Sign in"}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
