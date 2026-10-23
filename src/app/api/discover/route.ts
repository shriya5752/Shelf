import { headers } from "next/headers";
import type { SearchResult } from "@/lib/types";
import { entryKey } from "@/lib/types";
import { popularCatalog } from "@/lib/catalog";
import { tmdbFetch } from "@/lib/tmdb";

const TMDB = "https://api.themoviedb.org/3";

type TmdbHit = {
  id: number; title?: string; name?: string; release_date?: string; first_air_date?: string; poster_path?: string | null;
};

const toResult = (r: TmdbHit, mediaType: "movie" | "tv"): SearchResult => {
  const date = r.release_date || r.first_air_date || "";
  return {
    source: "tmdb",
    externalId: r.id,
    mediaType,
    title: (r.title || r.name || "").trim(),
    year: /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null,
    thumb: `https://image.tmdb.org/t/p/w342${r.poster_path}`,
    poster: `https://image.tmdb.org/t/p/w780${r.poster_path}`,
  };
};

/** "Popular right now" picks for a brand-new shelf. */
export async function GET() {
  await headers(); // opt in to request-time rendering so the key is read at runtime, not build time
  const key = process.env.TMDB_API_KEY;
  if (!key) return Response.json({ results: popularCatalog(), provider: "demo" });
  try {
    // Mostly the most-watched titles of all time (so people recognise them), plus a little of what's trending.
    const page = 1 + Math.floor(Math.random() * 2);
    const feeds: { path: string; kind: "movie" | "tv"; take: number }[] = [
      { path: "discover/movie?sort_by=vote_count.desc&include_adult=false&page=" + page, kind: "movie", take: 14 },
      { path: "discover/tv?sort_by=vote_count.desc&include_adult=false&page=" + page, kind: "tv", take: 14 },
      { path: "trending/movie/week?", kind: "movie", take: 4 },
      { path: "trending/tv/week?", kind: "tv", take: 4 },
    ];
    const lists = await Promise.all(
      feeds.map(async ({ path, kind, take }) => {
        const res = await tmdbFetch(`${TMDB}/${path}${path.includes("?") ? "&" : "?"}api_key=${key}`);
        if (!res.ok) throw new Error(`TMDB ${res.status}`);
        const j = (await res.json()) as { results?: TmdbHit[] };
        return (j.results ?? []).filter((r) => r.poster_path).slice(0, take).map((r) => toResult(r, kind));
      }),
    );
    const seen = new Set<string>();
    const mixed: SearchResult[] = [];
    for (let i = 0; i < 14 && mixed.length < 30; i++) {
      for (const list of lists) {
        const r = list[i];
        if (!r || seen.has(entryKey(r))) continue;
        seen.add(entryKey(r));
        mixed.push(r);
      }
    }
    return Response.json({ results: mixed, provider: "tmdb" });
  } catch {
    return Response.json({ results: [], error: "Couldn't load popular titles right now." }, { status: 502 });
  }
}
