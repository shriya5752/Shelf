import { limited } from "@/lib/ratelimit";
import type { SearchResult } from "@/lib/types";
import { smartPicks } from "@/lib/smartpicks";
import { tmdbFetch } from "@/lib/tmdb";

const TMDB = "https://api.themoviedb.org/3";

const ids = (sp: URLSearchParams, key: string): number[] =>
  (sp.get(key) ?? "")
    .split(",")
    .filter((s) => /^\d{1,9}$/.test(s))
    .slice(0, 800)
    .map(Number);

/**
 *   GET /api/smartpicks?liked=27205,603&seen=27205,603,550&beta=0.5&limit=18
 * `liked`: movies the person liked.  `seen`: everything on their shelf/list (never suggested).
 * Movies only, and only ones up to 2018: that is all the model was trained on.
 */
export async function GET(request: Request) {
  const tooMany = limited(request);
  if (tooMany) return tooMany;
  const sp = new URL(request.url).searchParams;
  const liked = ids(sp, "liked");
  const seen = ids(sp, "seen");
  const betaRaw = sp.get("beta");
  const beta = betaRaw === null || betaRaw === "" || Number.isNaN(Number(betaRaw)) ? 0.5 : Math.min(Math.max(Number(betaRaw), 0), 0.75);
  const limit = Math.min(Math.max(Math.floor(Number(sp.get("limit"))) || 18, 1), 30);

  let out;
  try {
    out = smartPicks(liked, seen, beta, limit);
  } catch {
    return Response.json({ results: [], error: "Smart picks isn't available right now." }, { status: 500 });
  }

  // posters from TMDB (the model only stores ids, titles and numbers)
  const key = process.env.TMDB_API_KEY;
  const results: SearchResult[] = await Promise.all(
    out.picks.map(async (p): Promise<SearchResult> => {
      const base: SearchResult = {
        source: "tmdb", externalId: p.tmdbId, mediaType: "movie", title: p.title, year: p.year || null,
        thumb: null, poster: null, match: p.match, because: p.because,
      };
      if (!key) return base;
      try {
        const res = await tmdbFetch(`${TMDB}/movie/${p.tmdbId}?api_key=${key}`, 2);
        if (!res.ok) return base;
        const j = (await res.json()) as { title?: string; poster_path?: string | null; release_date?: string };
        if (!j.poster_path) return base;
        return {
          ...base,
          title: (j.title || p.title).trim(),
          year: /^\d{4}/.test(j.release_date ?? "") ? Number((j.release_date as string).slice(0, 4)) : base.year,
          thumb: `https://image.tmdb.org/t/p/w342${j.poster_path}`,
          poster: `https://image.tmdb.org/t/p/w780${j.poster_path}`,
        };
      } catch {
        return base;
      }
    }),
  );

  return Response.json({ results, matched: out.matched, likedCount: out.likedCount, total: out.total, latestYear: out.latestYear, beta });
}
