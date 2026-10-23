import { limited } from "@/lib/ratelimit";
import type { SearchResult } from "@/lib/types";
import { tmdbFetch } from "@/lib/tmdb";

const TMDB = "https://api.themoviedb.org/3";

type Hit = {
  id: number; title?: string; name?: string; release_date?: string; first_air_date?: string;
  poster_path?: string | null; vote_average?: number; vote_count?: number;
};

/**
 * "If you liked X, try Y": TMDB's own recommendations for up to 6 seed titles, merged and ranked.
 * A title recommended by several of your favourites ranks higher.
 *   GET /api/recommend?seeds=movie:27205,tv:1396&limit=24
 */
export async function GET(request: Request) {
  const tooMany = limited(request);
  if (tooMany) return tooMany;
  const sp = new URL(request.url).searchParams;
  const key = process.env.TMDB_API_KEY;
  if (!key) return Response.json({ results: [], error: "Recommendations need a TMDB key." }, { status: 501 });

  const seeds = (sp.get("seeds") ?? "")
    .split(",")
    .map((s) => s.split(":"))
    .filter(([t, id]) => (t === "movie" || t === "tv") && /^\d{1,9}$/.test(id ?? ""))
    .slice(0, 6) as ["movie" | "tv", string][];
  if (!seeds.length) return Response.json({ results: [] });
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 24, 1), 40);
  const seedKeys = new Set(seeds.map(([t, id]) => `${t}:${id}`));

  try {
    const lists = await Promise.all(
      seeds.map(async ([type, id]) => {
        const res = await tmdbFetch(`${TMDB}/${type}/${id}/recommendations?api_key=${key}`);
        if (!res.ok) return [];
        const j = (await res.json()) as { results?: Hit[] };
        return (j.results ?? []).filter((r) => r.poster_path).map((r) => ({ r, type }));
      }),
    );
    const scored = new Map<string, { result: SearchResult; score: number }>();
    for (const list of lists) {
      list.forEach(({ r, type }, rank) => {
        const k = `${type}:${r.id}`;
        if (seedKeys.has(k)) return;
        const date = r.release_date || r.first_air_date || "";
        const base = scored.get(k) ?? {
          score: 0,
          result: {
            source: "tmdb" as const,
            externalId: r.id,
            mediaType: type,
            title: (r.title || r.name || "").trim(),
            year: /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null,
            thumb: `https://image.tmdb.org/t/p/w342${r.poster_path}`,
            poster: `https://image.tmdb.org/t/p/w780${r.poster_path}`,
          },
        };
        // appearing in more than one list is the strongest signal; earlier rank and a good score help
        base.score += 1 + (r.vote_average ?? 0) / 20 + (20 - rank) / 40;
        scored.set(k, base);
      });
    }
    const results = [...scored.values()].sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.result);
    return Response.json({ results });
  } catch {
    return Response.json({ results: [], error: "Couldn't load recommendations right now." }, { status: 502 });
  }
}
