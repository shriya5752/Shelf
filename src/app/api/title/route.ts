import { limited } from "@/lib/ratelimit";
import type { TitleDetails } from "@/lib/types";
import { catalogDetails } from "@/lib/catalog";
import { tmdbFetch } from "@/lib/tmdb";

const TMDB = "https://api.themoviedb.org/3";

/** TMDB genre names -> short labels; combined TV genres are split in two. */
function normaliseGenres(names: string[]): string[] {
  const out: string[] = [];
  for (const n of names) {
    for (const part of n.split(" & ")) {
      const p = part === "Science Fiction" ? "Sci-Fi" : part;
      if (!out.includes(p)) out.push(p);
    }
  }
  return out.slice(0, 4);
}

async function tmdbDetails(type: "movie" | "tv", id: number, key: string): Promise<TitleDetails> {
  const res = await tmdbFetch(`${TMDB}/${type}/${id}?api_key=${key}${type === "movie" ? "&append_to_response=credits" : ""}`);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const j = (await res.json()) as {
    genres?: { name: string }[]; release_date?: string; first_air_date?: string; number_of_seasons?: number;
    poster_path?: string | null; created_by?: { name: string }[];
    credits?: { crew?: { job: string; name: string }[] };
  };
  const date = j.release_date || j.first_air_date || "";
  const creator =
    type === "movie"
      ? (j.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name).slice(0, 2).join(" & ")
      : (j.created_by ?? []).map((c) => c.name).slice(0, 2).join(" & ");
  return {
    creator,
    genres: normaliseGenres((j.genres ?? []).map((g) => g.name)),
    seasons: type === "tv" ? j.number_of_seasons ?? null : null,
    year: /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null,
    poster: j.poster_path ? `https://image.tmdb.org/t/p/w780${j.poster_path}` : null,
  };
}

export async function GET(request: Request) {
  const tooMany = limited(request);
  if (tooMany) return tooMany;
  const sp = new URL(request.url).searchParams;
  const source = sp.get("source");
  const type = sp.get("type");
  const id = Number(sp.get("id"));
  if (!Number.isInteger(id) || id <= 0 || id > 2_000_000_000) return Response.json({ error: "Bad request" }, { status: 400 });

  if (source === "demo") {
    const d = catalogDetails(id);
    return d ? Response.json(d) : Response.json({ error: "Not found" }, { status: 404 });
  }
  if (source === "tmdb" && (type === "movie" || type === "tv")) {
    const key = process.env.TMDB_API_KEY;
    if (!key) return Response.json({ error: "TMDB key missing" }, { status: 501 });
    try {
      return Response.json(await tmdbDetails(type, id, key));
    } catch (e) {
      if (e instanceof Error && /TMDB 404/.test(e.message)) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json({ error: "Couldn't load details" }, { status: 502 });
    }
  }
  return Response.json({ error: "Bad request" }, { status: 400 });
}
