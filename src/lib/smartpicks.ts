import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Smart picks: the small model trained in /ml (see the notebook and the site's /model page).
 * Every movie has a vector. A person's taste is the sum of the vectors of the movies they liked, and
 * movies are ranked by how well their vector lines up with it. Nothing is trained or stored per person.
 */

type Meta = { count: number; dim: number; latest_movie_year: number; hand_over_n0: number; [k: string]: unknown };
type Store = {
  meta: Meta;
  n: number;
  dim: number;
  tmdb: Int32Array;
  title: string[];
  year: Int16Array;
  logPop: Float64Array;
  V: Float32Array;
  norm: Float64Array;
  index: Map<number, number>;
};

let cache: Store | null = null;

export function loadStore(): Store {
  if (cache) return cache;
  const dir = path.join(process.cwd(), "data", "smartpicks");
  const meta = JSON.parse(readFileSync(path.join(dir, "meta.json"), "utf8")) as Meta;
  const rows = JSON.parse(readFileSync(path.join(dir, "items.json"), "utf8")) as [number, string, number, number][];
  const raw = readFileSync(path.join(dir, "vectors.f32"));
  const V = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)); // copy: guarantees 4-byte alignment
  const n = rows.length;
  const dim = meta.dim;
  if (V.length !== n * dim) throw new Error("smartpicks data files are out of step");
  const norm = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let d = 0; d < dim; d++) s += V[i * dim + d] * V[i * dim + d];
    norm[i] = Math.sqrt(s);
  }
  cache = {
    meta, n, dim,
    tmdb: Int32Array.from(rows, (r) => r[0]),
    title: rows.map((r) => r[1]),
    year: Int16Array.from(rows, (r) => r[2]),
    logPop: Float64Array.from(rows, (r) => Math.log1p(r[3])),
    V, norm,
    index: new Map(rows.map((r, i) => [r[0], i])),
  };
  return cache;
}

export type Pick = { tmdbId: number; title: string; year: number; match: number; because: string[] };
export type PicksResult = { picks: Pick[]; matched: number; likedCount: number; total: number; latestYear: number };

const z = (x: Float64Array): Float64Array => {
  let mean = 0;
  for (const v of x) mean += v;
  mean /= x.length;
  let ss = 0;
  for (const v of x) ss += (v - mean) * (v - mean);
  const sd = Math.sqrt(ss / x.length) + 1e-9;
  return x.map((v) => (v - mean) / sd);
};

/**
 * @param liked  TMDB ids of movies the person liked
 * @param seen   TMDB ids of everything already on their shelf or list (never suggested)
 * @param beta   0 = safest (more blockbusters) ... 0.75 = most adventurous
 */
export function smartPicks(liked: number[], seen: number[], beta: number, limit: number): PicksResult {
  const S = loadStore();
  const hist = [...new Set(liked)].map((t) => S.index.get(t)).filter((i): i is number => i !== undefined);
  const base = { matched: hist.length, likedCount: new Set(liked).size, total: S.n, latestYear: S.meta.latest_movie_year };
  // no history at all: w below is 0, so this simply lists popular movies

  // taste = sum of the vectors of the liked movies
  const taste = new Float64Array(S.dim);
  for (const i of hist) for (let d = 0; d < S.dim; d++) taste[d] += S.V[i * S.dim + d];

  // score every movie; dividing by length^beta nudges toward less obvious titles
  const raw = new Float64Array(S.n);
  for (let i = 0; i < S.n; i++) {
    let dot = 0;
    for (let d = 0; d < S.dim; d++) dot += S.V[i * S.dim + d] * taste[d];
    raw[i] = beta > 0 ? dot / Math.pow(S.norm[i] + 1e-9, beta) : dot;
  }
  // with little history the personal signal is weak: lean on popularity and fade it out as the shelf grows
  const w = Math.min(1, hist.length / (S.meta.hand_over_n0 || 40));
  const zs = z(raw), zp = z(S.logPop);
  const final = new Float64Array(S.n);
  for (let i = 0; i < S.n; i++) final[i] = w * zs[i] + (1 - w) * zp[i];

  const exclude = new Set<number>(hist);
  for (const t of seen) {
    const i = S.index.get(t);
    if (i !== undefined) exclude.add(i);
  }
  const eligible: number[] = [];
  for (let i = 0; i < S.n; i++) if (!exclude.has(i)) eligible.push(i);
  eligible.sort((a, b) => final[b] - final[a]);

  const vals = eligible.map((i) => final[i]);
  const median = vals[Math.floor(vals.length / 2)];
  const top = vals[0];
  const picks: Pick[] = eligible.slice(0, limit).map((i) => {
    // which of your own movies pulled this one in?
    const contrib = hist.map((h) => {
      let dot = 0;
      for (let d = 0; d < S.dim; d++) dot += S.V[h * S.dim + d] * S.V[i * S.dim + d];
      return { h, dot };
    });
    contrib.sort((a, b) => b.dot - a.dot);
    return {
      tmdbId: S.tmdb[i],
      title: S.title[i],
      year: S.year[i],
      match: Math.round(Math.max(0, Math.min(1, (final[i] - median) / (top - median + 1e-12))) * 100),
      because: contrib.slice(0, 2).map((c) => S.title[c.h]),
    };
  });
  return { picks, ...base };
}
