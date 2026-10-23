"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Profile } from "@/lib/db";

type Result = { ok: true } | { ok: false; message: string };

type Props = {
  profile: Profile;
  email?: string;
  onSave: (patch: { username?: string; displayName?: string | null; isPublic?: boolean }) => Promise<Result>;
  onChangePassword: (password: string) => Promise<Result>;
  onClose: () => void;
};

type Msg = { kind: "ok" | "err"; text: string } | null;

export default function SettingsModal({ profile, email, onSave, onChangePassword, onClose }: Props) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [username, setUsername] = useState(profile.username);
  const [isPublic, setIsPublic] = useState(profile.isPublic);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [pw, setPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<Msg>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const uname = username.trim().toLowerCase();
  const changed = displayName.trim() !== (profile.displayName ?? "") || uname !== profile.username || isPublic !== profile.isPublic;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!/^[a-z0-9_]{3,20}$/.test(uname)) return setMsg({ kind: "err", text: "Usernames use 3–20 lowercase letters, numbers or underscores." });
    setBusy(true);
    const res = await onSave({ username: uname, displayName: displayName.trim() || null, isPublic });
    setBusy(false);
    setMsg(res.ok ? { kind: "ok", text: "Saved." } : { kind: "err", text: res.message });
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (pw.length < 8) return setPwMsg({ kind: "err", text: "Use at least 8 characters." });
    setPwBusy(true);
    const res = await onChangePassword(pw);
    setPwBusy(false);
    if (res.ok) setPw("");
    setPwMsg(res.ok ? { kind: "ok", text: "Password updated." } : { kind: "err", text: res.message });
  }

  const link = typeof window !== "undefined" ? `${window.location.origin}/u/${uname || profile.username}` : "";

  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Account settings"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        <div className="sheet-head">
          <h2>Your account</h2>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="sheet-body">
          <form onSubmit={save}>
            {email && <p className="note" style={{ marginTop: 0 }}>Signed in as {email}</p>}
            <label className="field">
              <span>Display name</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} placeholder="Shown as “Name’s watchlist”" />
            </label>
            <label className="field">
              <span>Username (your public link)</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} autoComplete="username" />
            </label>
            <p className="note">{link}</p>

            <div className="switchrow">
              <div>
                <b>{isPublic ? "Public shelf" : "Private shelf"}</b>
                <small>{isPublic ? "Anyone with your link can see your shelf and lists." : "Only you can see it. Your link will say the shelf doesn’t exist."}</small>
              </div>
              <button type="button" role="switch" aria-checked={isPublic} className={`switch${isPublic ? " on" : ""}`} onClick={() => setIsPublic((v) => !v)}>
                <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }} />
              </button>
            </div>

            <AnimatePresence>
              {msg && (
                <motion.p key={msg.text} className={`hint${msg.kind === "err" ? " err" : ""}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {msg.text}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="foot">
              <span />
              <button className="btn" disabled={busy || !changed}>{busy ? "Saving…" : "Save changes"}</button>
            </div>
          </form>

          <form onSubmit={updatePassword} style={{ marginTop: 26, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
            <label className="field" style={{ marginTop: 0 }}>
              <span>New password</span>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} autoComplete="new-password" placeholder="At least 8 characters" />
            </label>
            <AnimatePresence>
              {pwMsg && (
                <motion.p key={pwMsg.text} className={`hint${pwMsg.kind === "err" ? " err" : ""}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {pwMsg.text}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="foot">
              <span />
              <button className="btn ghost" disabled={pwBusy || !pw}>{pwBusy ? "Updating…" : "Update password"}</button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}
