# Launching Shelf

Order matters. You do the steps that need your accounts; everything in the code is already prepared.

## 1. Clean the database (keep `shsh`)
Supabase → **Authentication → Users**: delete the trial users except `shsh`. Their shelves are removed with them.
`shsh` and its titles are untouched.

## 2. Put the code on GitHub
Create an empty repo on github.com, then in this folder:
```
git init
git add .
git commit -m "Shelf"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```
`.env.local` is gitignored, so your keys are not uploaded.

## 3. Deploy on Vercel
Import the repo at vercel.com. Add these environment variables (Settings → Environment Variables):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the publishable key |
| `TMDB_API_KEY` | your TMDB key |
| `NEXT_PUBLIC_FEATURED_USERNAME` | `shsh` |
| `NEXT_PUBLIC_SITE_URL` | your final site address (for link previews) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | optional, shown on the privacy page |

Deploy.

## 4. Tell Supabase the live address
**Authentication → URL Configuration** → Site URL = your Vercel address, and add it to Redirect URLs.

## 5. Emails from your own name
Follow `supabase/email-templates/README.md`.

## 6. Check
Open the site signed out (you should see `shsh`'s shelf), sign up with a spare email, confirm, add a title, open `/u/<name>`.
