import type { Entry } from "./types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2021-03" -> "March 2021", "2021-03-14" -> "14 March 2021" */
export function fmtDate(w: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(w ?? "");
  if (!m) return w ?? "";
  return (m[3] ? `${+m[3]} ` : "") + MONTHS[+m[2] - 1] + " " + m[1];
}

/** Timeline order: dated titles oldest to newest, then undated in the order they were added. */
export function sortEntries(list: Entry[]): Entry[] {
  return [...list].sort((a, b) => {
    if (a.watchedOn && b.watchedOn) return a.watchedOn.localeCompare(b.watchedOn);
    if (a.watchedOn) return -1;
    if (b.watchedOn) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function matchesQuery(e: Entry, q: string): boolean {
  if (!q) return true;
  const hay = [e.title, e.creator, e.liked, e.learned, e.year ?? "", ...e.genres].join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

// ---------------------------------------------------------------- sorting & grouping

export type SortKey = "watched" | "rating" | "title" | "released" | "added";
export type SortDir = "asc" | "desc";

export const SORT_LABELS: Record<SortKey, string> = {
  watched: "Date watched",
  rating: "Rating",
  title: "Title (A–Z)",
  released: "Release year",
  added: "Recently added",
};

/** Label shown on the divider for a group (year watched). */
export const yearGroup = (e: Entry): string => (e.watchedOn ? e.watchedOn.slice(0, 4) : "Undated");

/**
 * Order a shelf. Titles missing the sorted value (no date, no rating, ...) always go last.
 * With `group`, titles are first clustered by the year they were watched, then sorted inside each year.
 */
export function orderEntries(list: Entry[], key: SortKey, dir: SortDir, group: boolean): Entry[] {
  const sign = dir === "asc" ? 1 : -1;
  const inner = (a: Entry, b: Entry): number => {
    switch (key) {
      case "watched": {
        if (!a.watchedOn && !b.watchedOn) return a.createdAt.localeCompare(b.createdAt);
        if (!a.watchedOn) return 1;
        if (!b.watchedOn) return -1;
        return sign * a.watchedOn.localeCompare(b.watchedOn);
      }
      case "rating": {
        if (!a.rating && !b.rating) return a.title.localeCompare(b.title);
        if (!a.rating) return 1;
        if (!b.rating) return -1;
        return sign * (a.rating - b.rating) || a.title.localeCompare(b.title);
      }
      case "title":
        return sign * a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      case "released": {
        if (!a.year && !b.year) return 0;
        if (!a.year) return 1;
        if (!b.year) return -1;
        return sign * (a.year - b.year) || a.title.localeCompare(b.title);
      }
      case "added":
        return sign * a.createdAt.localeCompare(b.createdAt);
    }
  };
  return [...list].sort((a, b) => {
    if (group) {
      const ga = yearGroup(a), gb = yearGroup(b);
      if (ga !== gb) {
        if (ga === "Undated") return 1;
        if (gb === "Undated") return -1;
        return sign * ga.localeCompare(gb);
      }
    }
    return inner(a, b);
  });
}
