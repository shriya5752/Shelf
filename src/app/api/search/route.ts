import { limited } from "@/lib/ratelimit";
import type { SearchResult } from "@/lib/types";
import { searchCatalog } from "@/lib/catalog";
import { tmdbFetch } from "@/lib/tmdb";

const TMDB = "https://api.themoviedb.org/3";

type TmdbHit = {
  id: number; media_type: string; title?: string; name?: string;
  release_date?: string; first_air_date?: string; poster_path?: string | null; overview?: string;
};

type Opts = { type?: "movie" | "tv"; year?: number; limit: number };

async function searchTmdb(q: string, key: string, o: Opts): Promise<SearchResult[]> {
  const scope = o.type ?? "multi";
  const yearParam = o.year ? (o.type === "tv" ? `&first_air_date_year=${o.year}` : o.type === "movie" ? `&year=${o.year}` : "") : "";
  const res = await tmdbFetch(`${TMDB}/search/${scope}?query=${encodeURIComponent(q)}&include_adult=false${yearParam}&api_key=${key}`);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const json = (await res.json()) as { results?: TmdbHit[] };
  return (json.results ?? [])
    .map((r) => ({ ...r, media_type: o.type ?? r.media_type }))
    .filter((r) => (r.media_type === "movie" || r.media_type === "tv") && r.poster_path)
    .slice(0, o.limit)
    .map((r) => {
      const date = r.release_date || r.first_air_date || "";
      return {
        source: "tmdb" as const,
        externalId: r.id,
        mediaType: r.media_type as "movie" | "tv",
        title: (r.title || r.name || "").trim(),
        year: /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null,
        thumb: `https://image.tmdb.org/t/p/w154${r.poster_path}`,
        poster: `https://image.tmdb.org/t/p/w780${r.poster_path}`,
        overview: r.overview?.slice(0, 220),
      };
    });
}

export async function GET(request: Request) {
  const tooMany = limited(request);
  if (tooMany) return tooMany;
  const sp = new URL(request.url).searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 100);
  const type = sp.get("type") === "tv" ? "tv" : sp.get("type") === "movie" ? "movie" : undefined;
  const y = Number(sp.get("year"));
  const opts: Opts = { type, year: Number.isInteger(y) && y > 1870 && y < 2100 ? y : undefined, limit: Math.min(Math.max(Number(sp.get("limit")) || 10, 1), 20) };
  if (q.length < 2) return Response.json({ results: [] });
  const key = process.env.TMDB_API_KEY;
  if (!key) return Response.json({ results: searchCatalog(q), provider: "demo" });
  try {
    return Response.json({ results: await searchTmdb(q, key, opts), provider: "tmdb" });
  } catch {
    return Response.json({ results: [], error: "Search is unavailable right now. Please try again." }, { status: 502 });
  }
}
