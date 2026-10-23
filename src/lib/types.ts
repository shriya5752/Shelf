export type MediaType = "movie" | "tv";
export type Source = "tmdb" | "demo";
export type Status = "watched" | "want";

export type Entry = {
  id: string;
  source: Source;
  externalId: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  creator: string;
  genres: string[];
  posterUrl: string | null;
  color: string;
  ink: string;
  seasons: number | null;
  status: Status; // watched, or on the "want to watch" list
  rating: number; // 0 = not rated
  watchedOn: string; // "" | "YYYY-MM" | "YYYY-MM-DD"
  liked: string;
  learned: string;
  createdAt: string;
};

export type Draft = Omit<Entry, "id" | "createdAt">;

export type SearchResult = {
  source: Source;
  externalId: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  thumb: string | null;
  poster: string | null;
  overview?: string;
  /** Smart picks only: relative 0-100 score, and which of your titles led to it */
  match?: number;
  because?: string[];
};

export type TitleDetails = {
  creator: string;
  genres: string[];
  seasons: number | null;
  year: number | null;
  poster: string | null;
};

export const entryKey = (e: { source: Source; mediaType: MediaType; externalId: number }) =>
  `${e.source}:${e.mediaType}:${e.externalId}`;
