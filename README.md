# Shelf

Search any movie or series, add it, and watch your own 3D library fill up. Each person gets a shelf
and a public link (`/u/username`).

Built with Next.js, Framer Motion and Supabase. Movie data and posters come from TMDB.

## Run it (works right now, no keys needed)

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without any keys the app runs in **demo mode**: your shelf is saved in
your browser, and search uses a small built-in catalogue of popular titles.

## Turn on accounts and public pages (Supabase)

1. Create a free project at https://supabase.com.
2. In the dashboard open **SQL Editor → New query**, paste the contents of
   `supabase/schema.sql`, and click **Run**. This creates the tables and the security rules
   (people can only change their own rows).
3. In **Project Settings → API** copy the **Project URL** and the **anon public** key.
   (Never use the `service_role` key in this app.)
4. In **Authentication → Providers → Email**, you can switch off "Confirm email" while testing,
   so sign-up works instantly. Switch it back on before launch.
5. Copy `.env.example` to `.env.local` and fill in the two Supabase values.

## Turn on search for every title (TMDB)

1. Create a free account at https://www.themoviedb.org and request an API key under
   **Settings → API**.
2. Put it in `.env.local` as `TMDB_API_KEY=...`. It is read on the server only.

With the key, search covers every movie and series, with sharp posters (780px) and the correct
director/creator, genres and season count. Spine colours are taken from each poster.

TMDB's free API is for non-commercial use and asks for a credit line such as
"This product uses the TMDB API but is not endorsed or certified by TMDB."
Add that to the footer before launching publicly (and get a commercial licence if you ever
charge money or run ads).

## Database updates

When a new feature needs a database change, a numbered file in `supabase/` is added (for example
`migration-002-watchlist.sql`). Paste it into **SQL Editor → New query** and click **Run**. They are safe to re-run.
Fresh installs only need `schema.sql`.

## Deploy

Push to GitHub and import the repo on https://vercel.com. Add the same three environment
variables in the Vercel project settings. Then add your Vercel URL under
Supabase **Authentication → URL Configuration → Site URL**.

## Where things are

| Path | What it does |
| --- | --- |
| `src/components/LibraryView.tsx` | The page: heading, filters, shelf, modals |
| `src/components/Shelf.tsx` | The 3D shelf: drop-in animation, momentum scrolling, curve, hover card |
| `src/components/AddModal.tsx` | Live search, then rating/date/notes |
| `src/components/Detail.tsx` | Opens a title: poster swing + notes |
| `src/lib/useShelf.ts` | Your shelf and auth (Supabase, or local demo mode) |
| `src/lib/spine.ts` | How a spine looks (width, height, tilt, poster colour) |
| `src/app/api/search`, `api/title` | Server routes that talk to TMDB (keeps the key private) |
| `supabase/schema.sql` | Database tables and security rules |

The original single-file prototype is in `../prototype/index.html`.
