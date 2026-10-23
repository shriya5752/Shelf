import type { Entry } from "./types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const tally = (items: string[]) => {
  const m = new Map<string, number>();
  for (const i of items) if (i) m.set(i, (m.get(i) ?? 0) + 1);
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

export type Summary = {
  total: number;
  movies: number;
  series: number;
  seasons: number;
  rated: number;
  avgRating: number | null;
  genres: { name: string; count: number }[];
  creators: { name: string; count: number }[];
  byYear: { year: string; count: number }[];
  undated: number;
  best: Entry[];
  busiestMonth: { label: string; count: number } | null;
  first: Entry | null;
  last: Entry | null;
};

/** Numbers for a set of watched titles (all time, or just one year). */
export function summarise(list: Entry[]): Summary {
  const rated = list.filter((e) => e.rating > 0);
  const dated = list.filter((e) => e.watchedOn).sort((a, b) => a.watchedOn.localeCompare(b.watchedOn));
  const months = tally(dated.map((e) => e.watchedOn.slice(0, 7)));
  const bm = months.sort((a, b) => b.count - a.count || b.name.localeCompare(a.name))[0];
  return {
    total: list.length,
    movies: list.filter((e) => e.mediaType === "movie").length,
    series: list.filter((e) => e.mediaType === "tv").length,
    seasons: list.reduce((n, e) => n + (e.mediaType === "tv" ? e.seasons ?? 0 : 0), 0),
    rated: rated.length,
    avgRating: rated.length ? rated.reduce((n, e) => n + e.rating, 0) / rated.length : null,
    genres: tally(list.flatMap((e) => e.genres)),
    creators: tally(list.map((e) => e.creator)).filter((c) => c.count > 1),
    byYear: tally(dated.map((e) => e.watchedOn.slice(0, 4))).map((y) => ({ year: y.name, count: y.count })).sort((a, b) => a.year.localeCompare(b.year)),
    undated: list.length - dated.length,
    best: [...rated].sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title)).slice(0, 6),
    busiestMonth: bm ? { label: `${MONTHS[Number(bm.name.slice(5, 7)) - 1]} ${bm.name.slice(0, 4)}`, count: bm.count } : null,
    first: dated[0] ?? null,
    last: dated[dated.length - 1] ?? null,
  };
}

export const monthName = (m: string) => MONTHS[Number(m) - 1] ?? "";

/** Titles watched in one calendar year, with the month they were watched in for the busiest-month line. */
export function forYear(list: Entry[], year: string): Entry[] {
  return list.filter((e) => e.watchedOn.startsWith(year));
}

export function monthCounts(list: Entry[]): { month: string; count: number }[] {
  const counts = Array.from({ length: 12 }, () => 0);
  for (const e of list) {
    const m = Number(e.watchedOn.slice(5, 7));
    if (m >= 1 && m <= 12) counts[m - 1]++;
  }
  return counts.map((count, i) => ({ month: MONTHS[i].slice(0, 3), count }));
}
