import type { SearchResult } from "./types";

export type ParsedLine = {
  raw: string;
  title: string;
  year: number | null;
  /** true = series, false = movie, undefined = no hint */
  tv: boolean | undefined;
};

/**
 * Turns pasted text into titles. One per line. Understands:
 *   Inception (2010)        Breaking Bad [series]        3. Titanic - 1997        - Mean Girls, 2004
 */
export function parseList(text: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) continue;
    line = line.replace(/^\s*(?:\d+\s*[.)]|[-*•·])\s+/, ""); // "1. ", "- ", "• "
    let tv: boolean | undefined;
    line = line.replace(/\s*[[(](series|tv|show|tv series|tv show)[\])]\s*/gi, () => ((tv = true), " "));
    line = line.replace(/\s*[[(](movie|film)[\])]\s*/gi, () => ((tv = false), " "));
    let year: number | null = null;
    const y = /\s*(?:[(\[]|[,\-–—]\s*)\s*((?:19|20)\d{2})\s*[)\]]?\s*$/.exec(line);
    if (y) {
      year = Number(y[1]);
      line = line.slice(0, y.index);
    }
    const title = line.replace(/\s+/g, " ").trim();
    if (title.length >= 1) out.push({ raw: raw.trim(), title, year, tv });
  }
  return out;
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, "and").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Choose the best search result for a line: matching title, year and type beat plain search order. */
export function bestMatch(results: SearchResult[], q: ParsedLine): SearchResult | null {
  const qt = norm(q.title);
  let best: { r: SearchResult; s: number } | null = null;
  results.forEach((r, i) => {
    const rt = norm(r.title);
    let s = 0;
    if (rt === qt) s += 10;
    else if (rt.startsWith(qt) || rt.endsWith(qt)) s += 5;
    else if (rt.includes(qt)) s += 3;
    else if (qt.includes(rt) && rt.length > 3) s += 2;
    if (q.year && r.year) s += r.year === q.year ? 6 : Math.abs(r.year - q.year) <= 1 ? 3 : -3;
    if (q.tv !== undefined) s += (r.mediaType === "tv") === q.tv ? 3 : -3;
    s -= i * 0.15;
    if (!best || s > best.s) best = { r, s };
  });
  const b = best as { r: SearchResult; s: number } | null;
  return b && b.s >= 2.5 ? b.r : null;
}
