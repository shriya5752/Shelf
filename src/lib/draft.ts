import type { Draft, SearchResult, Status, TitleDetails } from "./types";
import { extractColors, fallbackColors } from "./spine";

/** Turn a search/discover result into a ready-to-save entry: fetch details, pick spine colours from the poster. */
export async function draftFromResult(r: SearchResult, status: Status = "watched"): Promise<Draft> {
  let d: TitleDetails = { creator: "", genres: [], seasons: null, year: r.year, poster: r.poster };
  try {
    const qs = new URLSearchParams({ source: r.source, type: r.mediaType, id: String(r.externalId) });
    const res = await fetch(`/api/title?${qs}`);
    if (res.ok) d = (await res.json()) as TitleDetails;
  } catch {
    /* still saveable with the basics */
  }
  const posterUrl = d.poster ?? r.poster;
  const colors = (await extractColors(posterUrl)) ?? fallbackColors(r.title);
  return {
    source: r.source, externalId: r.externalId, mediaType: r.mediaType, title: r.title, year: d.year ?? r.year,
    creator: d.creator, genres: d.genres, posterUrl, color: colors.color, ink: colors.ink, seasons: d.seasons,
    status, rating: 0, watchedOn: "", liked: "", learned: "",
  };
}
