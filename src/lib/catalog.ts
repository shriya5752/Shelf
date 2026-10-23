import type { MediaType, SearchResult, TitleDetails } from "./types";

/**
 * A small built-in catalogue used for search when no TMDB key is configured (demo mode).
 * Format: type | title | year | creator | genres | seasons
 */
const RAW = `
m|Casablanca|1942|Michael Curtiz|Romance,Drama|
m|It's a Wonderful Life|1946|Frank Capra|Drama,Fantasy|
m|Rear Window|1954|Alfred Hitchcock|Mystery,Thriller|
m|12 Angry Men|1957|Sidney Lumet|Drama|
m|Psycho|1960|Alfred Hitchcock|Horror,Thriller|
m|Breakfast at Tiffany's|1961|Blake Edwards|Romance,Comedy|
m|The Sound of Music|1965|Robert Wise|Musical,Drama|
m|The Godfather|1972|Francis Ford Coppola|Crime,Drama|
m|Jaws|1975|Steven Spielberg|Thriller,Adventure|
m|Star Wars|1977|George Lucas|Sci-Fi,Adventure|
m|Grease|1978|Randal Kleiser|Musical,Romance|
m|Alien|1979|Ridley Scott|Sci-Fi,Horror|
m|The Shining|1980|Stanley Kubrick|Horror,Thriller|
m|E.T. the Extra-Terrestrial|1982|Steven Spielberg|Sci-Fi,Family|
m|Blade Runner|1982|Ridley Scott|Sci-Fi,Thriller|
m|Back to the Future|1985|Robert Zemeckis|Sci-Fi,Comedy|
m|The Breakfast Club|1985|John Hughes|Comedy,Drama|
m|Ferris Bueller's Day Off|1986|John Hughes|Comedy|
m|Dirty Dancing|1987|Emile Ardolino|Romance,Drama|
m|The Princess Bride|1987|Rob Reiner|Fantasy,Adventure|
m|Die Hard|1988|John McTiernan|Action,Thriller|
m|Dead Poets Society|1989|Peter Weir|Drama|
m|Home Alone|1990|Chris Columbus|Comedy,Family|
m|Pretty Woman|1990|Garry Marshall|Romance,Comedy|
m|The Silence of the Lambs|1991|Jonathan Demme|Thriller,Crime|
m|Jurassic Park|1993|Steven Spielberg|Sci-Fi,Adventure|
m|Schindler's List|1993|Steven Spielberg|Drama,History|
m|Forrest Gump|1994|Robert Zemeckis|Drama,Comedy|
m|The Shawshank Redemption|1994|Frank Darabont|Drama|
m|Pulp Fiction|1994|Quentin Tarantino|Crime,Thriller|
m|Toy Story|1995|John Lasseter|Animation,Family|
m|Jerry Maguire|1996|Cameron Crowe|Romance,Drama|
m|Titanic|1997|James Cameron|Romance,Drama|
m|Good Will Hunting|1997|Gus Van Sant|Drama|
m|The Parent Trap|1998|Nancy Meyers|Comedy,Family|
m|The Truman Show|1998|Peter Weir|Drama,Sci-Fi|
m|The Matrix|1999|The Wachowskis|Sci-Fi,Action|
m|Fight Club|1999|David Fincher|Drama,Thriller|
m|American Beauty|1999|Sam Mendes|Drama|
m|10 Things I Hate About You|1999|Gil Junger|Romance,Comedy|
m|Notting Hill|1999|Roger Michell|Romance,Comedy|
m|Gladiator|2000|Ridley Scott|Action,Drama|
m|Final Destination|2000|James Wong|Horror,Thriller|
m|Spirited Away|2001|Hayao Miyazaki|Animation,Fantasy|
m|Harry Potter and the Philosopher's Stone|2001|Chris Columbus|Fantasy,Adventure|
m|The Lord of the Rings: The Fellowship of the Ring|2001|Peter Jackson|Fantasy,Adventure|
m|Freaky Friday|2003|Mark Waters|Comedy,Family|
m|How to Lose a Guy in 10 Days|2003|Donald Petrie|Romance,Comedy|
m|Mean Girls|2004|Mark Waters|Comedy|
m|Eternal Sunshine of the Spotless Mind|2004|Michel Gondry|Romance,Sci-Fi|
m|The Notebook|2004|Nick Cassavetes|Romance,Drama|
m|Pride & Prejudice|2005|Joe Wright|Romance,Drama|
m|The Dark Knight|2008|Christopher Nolan|Action,Crime|
m|Slumdog Millionaire|2008|Danny Boyle|Drama,Romance|
m|Up|2009|Pete Docter|Animation,Family|
m|Avatar|2009|James Cameron|Sci-Fi,Adventure|
m|Inglourious Basterds|2009|Quentin Tarantino|War,Drama|
m|The Social Network|2010|David Fincher|Drama|
m|Inception|2010|Christopher Nolan|Sci-Fi,Thriller|
m|Interstellar|2014|Christopher Nolan|Sci-Fi,Drama|
m|The Intern|2015|Nancy Meyers|Comedy,Drama|
m|Me Before You|2016|Thea Sharrock|Romance,Drama|
m|La La Land|2016|Damien Chazelle|Musical,Romance|
m|Get Out|2017|Jordan Peele|Horror,Thriller|
m|Lady Bird|2017|Greta Gerwig|Comedy,Drama|
m|Bird Box|2018|Susanne Bier|Horror,Thriller|
m|Crazy Rich Asians|2018|Jon M. Chu|Romance,Comedy|
m|Parasite|2019|Bong Joon-ho|Thriller,Drama|
m|Little Women|2019|Greta Gerwig|Drama,Romance|
m|Avengers: Endgame|2019|Anthony & Joe Russo|Action,Sci-Fi|
m|Joker|2019|Todd Phillips|Crime,Drama|
m|Knives Out|2019|Rian Johnson|Mystery,Comedy|
m|Dune|2021|Denis Villeneuve|Sci-Fi,Adventure|
m|Everything Everywhere All at Once|2022|The Daniels|Sci-Fi,Comedy|
m|Top Gun: Maverick|2022|Joseph Kosinski|Action,Drama|
m|Oppenheimer|2023|Christopher Nolan|Drama,History|
m|Barbie|2023|Greta Gerwig|Comedy,Fantasy|
m|Family Switch|2023|McG|Comedy,Fantasy|
m|It Ends with Us|2024|Justin Baldoni|Romance,Drama|
m|The Map That Leads to You|2025|Lasse Hallström|Romance,Drama|
m|People We Meet on Vacation|2026|Brett Haley|Romance,Comedy|
t|Friends|1994|David Crane & Marta Kauffman|Comedy,Romance|10
t|Gilmore Girls|2000|Amy Sherman-Palladino|Comedy,Drama|7
t|The Office|2005|Greg Daniels|Comedy|9
t|How I Met Your Mother|2005|Carter Bays & Craig Thomas|Comedy,Romance|9
t|Grey's Anatomy|2005|Shonda Rhimes|Drama,Romance|21
t|Gossip Girl|2007|Josh Schwartz & Stephanie Savage|Drama,Romance|6
t|Breaking Bad|2008|Vince Gilligan|Crime,Drama|5
t|The Vampire Diaries|2009|Kevin Williamson & Julie Plec|Fantasy,Drama|8
t|Modern Family|2009|Christopher Lloyd & Steven Levitan|Comedy,Family|11
t|Brooklyn Nine-Nine|2013|Dan Goor & Michael Schur|Comedy,Crime|8
t|Peaky Blinders|2013|Steven Knight|Crime,Drama|6
t|Game of Thrones|2011|David Benioff & D. B. Weiss|Fantasy,Drama|8
t|Black Mirror|2011|Charlie Brooker|Sci-Fi,Thriller|7
t|Sherlock|2010|Mark Gatiss & Steven Moffat|Mystery,Crime|4
t|Fleabag|2016|Phoebe Waller-Bridge|Comedy,Drama|2
t|Stranger Things|2016|The Duffer Brothers|Sci-Fi,Horror|5
t|Young Sheldon|2017|Chuck Lorre & Steve Molaro|Comedy,Family|7
t|The Good Doctor|2017|David Shore|Drama|7
t|Money Heist|2017|Álex Pina|Crime,Thriller|5
t|Riverdale|2017|Roberto Aguirre-Sacasa|Mystery,Drama|7
t|Chernobyl|2019|Craig Mazin|Drama,History|1
t|Euphoria|2019|Sam Levinson|Drama|2
t|Never Have I Ever|2020|Mindy Kaling & Lang Fisher|Comedy,Drama|4
t|Bridgerton|2020|Chris Van Dusen|Romance,Drama|4
t|Emily in Paris|2020|Darren Star|Comedy,Romance|5
t|Lupin|2021|George Kay & François Uzan|Crime,Mystery|3
t|Squid Game|2021|Hwang Dong-hyuk|Thriller,Drama|3
t|Ginny & Georgia|2021|Sarah Lampert|Drama,Comedy|3
t|Behind Her Eyes|2021|Steve Lightfoot|Thriller,Mystery|1
t|Severance|2022|Dan Erickson|Sci-Fi,Thriller|2
t|Wednesday|2022|Alfred Gough & Miles Millar|Fantasy,Mystery|2
t|The Bear|2022|Christopher Storer|Drama,Comedy|3
t|Geek Girl|2024|Declan O'Dwyer|Comedy,Drama|2
`;

type CatalogItem = {
  id: number; mediaType: MediaType; title: string; year: number; creator: string; genres: string[]; seasons: number | null;
};

function idFor(title: string, year: number): number {
  let h = 5381;
  for (const c of `${title}|${year}`) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
  return Math.abs(h) + 1;
}

export const CATALOG: CatalogItem[] = RAW.trim().split("\n").map((line) => {
  const [t, title, year, creator, genres, seasons] = line.split("|");
  return {
    id: idFor(title, Number(year)),
    mediaType: t === "t" ? "tv" : "movie",
    title,
    year: Number(year),
    creator,
    genres: genres.split(","),
    seasons: seasons ? Number(seasons) : null,
  } satisfies CatalogItem;
});

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export function searchCatalog(q: string): SearchResult[] {
  const words = norm(q).split(" ").filter(Boolean);
  if (!words.length) return [];
  return CATALOG.map((c) => {
    const t = norm(c.title);
    if (!words.every((w) => t.includes(w))) return null;
    const score = (t === words.join(" ") ? 0 : t.startsWith(words.join(" ")) ? 1 : t.split(" ").some((x) => x.startsWith(words[0])) ? 2 : 3);
    return { c, score };
  })
    .filter((x): x is { c: CatalogItem; score: number } => !!x)
    .sort((a, b) => a.score - b.score || b.c.year - a.c.year)
    .slice(0, 10)
    .map(({ c }) => ({
      source: "demo" as const,
      externalId: c.id,
      mediaType: c.mediaType,
      title: c.title,
      year: c.year,
      thumb: null,
      poster: null,
    }));
}

export function catalogDetails(id: number): TitleDetails | null {
  const c = CATALOG.find((x) => x.id === id);
  return c ? { creator: c.creator, genres: c.genres, seasons: c.seasons, year: c.year, poster: null } : null;
}

const POPULAR = [
  "Inception", "Titanic", "Mean Girls", "Breaking Bad", "Stranger Things", "The Office", "Friends", "Squid Game",
  "Barbie", "Oppenheimer", "Parasite", "Interstellar", "The Dark Knight", "Forrest Gump", "Wednesday", "Money Heist",
  "Game of Thrones", "Bridgerton", "Dune", "La La Land", "Spirited Away", "The Notebook", "Harry Potter and the Philosopher's Stone", "Gilmore Girls",
];

/** Starter picks for demo mode (no TMDB key): well-known titles, no posters. */
export function popularCatalog(): SearchResult[] {
  return POPULAR.map((t) => CATALOG.find((c) => c.title === t))
    .filter((c): c is CatalogItem => !!c)
    .map((c) => ({ source: "demo" as const, externalId: c.id, mediaType: c.mediaType, title: c.title, year: c.year, thumb: null, poster: null }));
}
