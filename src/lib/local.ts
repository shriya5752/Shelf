import type { Entry } from "./types";

const KEY = "shelf.demo.v1";

export function loadLocal(): Entry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Entry[]).map((e) => ({ ...e, status: e.status ?? "watched" })) : [];
  } catch {
    return [];
  }
}

export function saveLocal(entries: Entry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable: the shelf just won't persist */
  }
}
