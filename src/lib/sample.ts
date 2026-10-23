import type { Entry } from "./types";

const S = (
  i: number, title: string, mediaType: "movie" | "tv", year: number, creator: string,
  genres: string[], color: string, ink: string, watchedOn: string, seasons: number | null = null,
  liked = "", learned = "", rating = 0,
): Entry => ({
  id: `sample-${i}`, source: "tmdb", externalId: 9000 + i, mediaType, title, year, creator, genres,
  posterUrl: null, color, ink, seasons, status: "watched", rating, watchedOn, liked, learned, createdAt: `2020-01-${String(i + 10).padStart(2, "0")}`,
});

/** Shown to visitors who aren't signed in, so they can see what a shelf feels like. */
export const SAMPLE_ENTRIES: Entry[] = [
  S(1, "The Breakfast Club", "movie", 1985, "John Hughes", ["Comedy", "Drama"], "#c9a227", "#2a1d00", "2019-02"),
  S(2, "Titanic", "movie", 1997, "James Cameron", ["Romance", "Drama"], "#0e2a47", "#d9c9a0", "2019-09", null, "The scale of it, and the ending.", "Some things are worth holding on to.", 4),
  S(3, "Mean Girls", "movie", 2004, "Mark Waters", ["Comedy"], "#ee6fae", "#ffffff", "2020-01"),
  S(4, "Breaking Bad", "tv", 2008, "Vince Gilligan", ["Crime", "Drama"], "#2f5d3a", "#f2e9a8", "2020-06", 5, "Perfect pacing, every season escalates.", "Small compromises compound.", 5),
  S(5, "Inception", "movie", 2010, "Christopher Nolan", ["Sci-Fi", "Thriller"], "#1f2a44", "#e8e2d0", "2020-11", null, "The layered dream logic.", "Ideas are sticky.", 5),
  S(6, "The Social Network", "movie", 2010, "David Fincher", ["Drama"], "#0f1218", "#9fb4d9", "2021-02"),
  S(7, "Money Heist", "tv", 2017, "Álex Pina", ["Crime", "Thriller"], "#a8141c", "#ffe9e0", "2021-05", 5),
  S(8, "Geek Girl", "tv", 2024, "Declan O'Dwyer", ["Comedy", "Drama"], "#f0a8c8", "#3d1230", "2021-08", 2),
  S(9, "Squid Game", "tv", 2021, "Hwang Dong-hyuk", ["Thriller", "Drama"], "#e0457b", "#ffffff", "2021-10", 3, "The tension, and the sets.", "Systems reward the people who play them.", 4),
  S(10, "Black Mirror", "tv", 2011, "Charlie Brooker", ["Sci-Fi", "Thriller"], "#0a0a0c", "#e8e8ee", "2022-03", 7),
  S(11, "Notting Hill", "movie", 1999, "Roger Michell", ["Romance", "Comedy"], "#cfd8c0", "#26331f", "2022-07"),
  S(12, "Gilmore Girls", "tv", 2000, "Amy Sherman-Palladino", ["Comedy", "Drama"], "#d9a15e", "#3b2208", "2022-12", 7),
  S(13, "Forrest Gump", "movie", 1994, "Robert Zemeckis", ["Drama", "Comedy"], "#a9b8c4", "#1b2a36", "2023-04"),
  S(14, "The Vampire Diaries", "tv", 2009, "Kevin Williamson & Julie Plec", ["Fantasy", "Drama"], "#1d1a2e", "#c9b6ff", "2023-09", 8),
  S(15, "It Ends with Us", "movie", 2024, "Justin Baldoni", ["Romance", "Drama"], "#f4d6dc", "#5a1f2e", "2024-08"),
  S(16, "Lupin", "tv", 2021, "George Kay & François Uzan", ["Crime", "Mystery"], "#111111", "#d9b44a", "2024-11", 3),
];
