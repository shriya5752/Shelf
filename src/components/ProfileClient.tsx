"use client";

import { useEffect, useState } from "react";
import type { Entry } from "@/lib/types";
import { isDemo } from "@/lib/supabase";
import { getProfileByUsername, listEntries } from "@/lib/db";
import { loadLocal } from "@/lib/local";
import { sortEntries } from "@/lib/format";
import Link from "next/link";
import LibraryView from "./LibraryView";
import type { MenuItem } from "./Menu";

type State = { kind: "loading" } | { kind: "missing" } | { kind: "ready"; entries: Entry[]; username: string; name: string };

export default function ProfileClient({ username, actions, menuItems }: { username: string; actions?: React.ReactNode; menuItems?: MenuItem[] }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isDemo) {
          // no database in demo mode: only your own local shelf exists
          if (username.toLowerCase() === "demo") {
            if (!cancelled) setState({ kind: "ready", entries: sortEntries(loadLocal()), username: "demo", name: "demo" });
          } else if (!cancelled) setState({ kind: "missing" });
          return;
        }
        const profile = await getProfileByUsername(username);
        if (!profile) return void (!cancelled && setState({ kind: "missing" }));
        const entries = await listEntries(profile.id);
        if (!cancelled) setState({ kind: "ready", entries: sortEntries(entries), username: profile.username, name: profile.displayName || profile.username });
      } catch {
        if (!cancelled) setState({ kind: "missing" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (state.kind === "loading") return <div className="boot">shelf.</div>;

  if (state.kind === "missing") {
    return (
      <div className="boot" style={{ flexDirection: "column", gap: 18, textAlign: "center", padding: 24 }}>
        <div>This shelf doesn’t exist, or it’s private.</div>
        <Link className="btn" href="/" style={{ textDecoration: "none" }}>Make your own</Link>
      </div>
    );
  }

  return (
    <LibraryView
      eyebrow="A film & series diary"
      heading={`${state.name}’s watchlist`}
      statsName={state.name}
      menuItems={menuItems}
      entries={state.entries}
      topRight={actions ?? <Link className="btn ghost small" href="/" style={{ textDecoration: "none" }}>Make your own</Link>}
    />
  );
}
