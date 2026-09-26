# Permit Log Register — Web Dashboard

Read-only work permit monitoring site for the SWWS Salalah permit log.
Excel remains the master record. This site never writes back to it.

## Authentication & roles

The whole site now requires a real login — there is no public page
anymore, including the dashboard. Accounts and sessions are handled
by **Supabase Auth** (free tier), not by this app's own code, so there's
no password storage or session logic to maintain here.

- **`user` role** — can view the dashboard, the permit list, and permit
  detail pages. No upload access.
- **`admin` role** — everything a `user` can do, plus `/upload`.

Roles live in a `profiles` table in Supabase Postgres (see
`supabase-schema.sql`), one row per account, with a `role` column and
an empty `permissions` jsonb column reserved for finer-grained flags
you add later — adding a new permission won't require touching the
auth flow again, just checking that field where it matters.

There is **no self-signup** — accounts are created by you from the
Supabase dashboard (Authentication → Users → Add user), and default to
`role = 'user'` via a database trigger. Promote an account to admin
with one SQL statement (see `supabase-schema.sql`, step 3).

Enforcement happens in two places, deliberately redundant:
`middleware.js` (blocks every request before it reaches a page or
API route) and the `/upload` page and `/api/upload` route themselves
(re-check independently, so the lock holds even if the middleware
config ever changes).

## What this update changed

**1. Theme — dark by default, with a light/dark switch**
Violet-accented dark theme (soft glow behind the header, rounded
cards, icon chips) with a working switch in the header nav. Choice is
remembered per-browser (`localStorage`), and a small inline script in
`app/layout.js` applies it before first paint so there's no flash of
the wrong theme. Status colors (open/expiring/expired/closed/canceled)
stay distinct from the violet accent so they're never ambiguous.

**2. A fuller dashboard**
Beyond the 6 status cards: a hero "Total Permits" card, a status
distribution donut (pure SVG, no chart library), an "Expiring Soon"
watchlist, and Area / Permit Type breakdown bars. All computed from
columns already in your workbook — no new data required.

**3. Supabase-backed login, with user/admin roles**
Replaces the earlier shared-passcode gate. Every page now requires
signing in; only `admin` accounts see and can use `/upload`. See
"Authentication & roles" above.

**4. Housekeeping**
Bumped `next` from `14.2.5` → `^14.2.35` (the `14.2.5` line had
several CVEs patched in Next.js's December 2025 security update).

## Known caveat carried over from before

Your Blob store is on **public** access, meaning the raw `.xlsm` file
itself is fetchable by anyone with its exact blob URL, independent of
the login above. Vercel Blob access mode can't be changed after a
store is created, so fixing that means creating a new **private**
store and pointing `lib/blob.js` at it, or moving the file to Supabase
Storage (private buckets by default) when you set that up — happy to
do either in a follow-up.

## Deploy checklist

1. **Create a Supabase project** at supabase.com (free tier is fine).
   In the SQL Editor, paste and run the contents of
   `supabase-schema.sql` from this folder.
2. **Turn off public signups**: Supabase Dashboard → Authentication →
   Providers/Settings → disable "Allow new users to sign up" (name may
   vary slightly by Supabase's current UI). Accounts are created by
   you only.
3. **Create your own account**: Authentication → Users → Add user
   (email + password). Then in the SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
4. **Get your API keys**: Project Settings → API → copy the Project
   URL and the `anon` `public` key.
5. **Replace your GitHub repo's files** with everything in this
   folder (keep the same repo/project so your existing Blob store
   stays connected). `node_modules` and `.next` are intentionally not
   included — Vercel builds those itself.
6. **Add environment variables** in Vercel → your Project → Settings →
   Environment Variables (apply to Production, and Preview/Development
   if you use them):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   You can delete the old `HSE_UPLOAD_PASSWORD` and `AUTH_SECRET`
   variables — they're no longer used.
7. **Push to GitHub.** Vercel will redeploy automatically if it's
   connected to the repo.
8. **Re-test the checklist:**
   - [ ] Visiting the site in a private/incognito window redirects to
         `/login`, not the dashboard
   - [ ] Wrong email/password is rejected; your admin account signs in
   - [ ] Signed in as `admin`: the "Upload" link is visible, `/upload`
         shows the upload form, and uploading a fresh `.xlsm` updates
         the dashboard
   - [ ] A second account with `role = 'user'` (create one the same
         way, leave its role as `user`) can see the dashboard/permit
         list but has no "Upload" link, and `/upload` redirects it away
   - [ ] "Sign out" returns you to `/login` and re-locks everything
   - [ ] Calling `/api/upload` directly while signed in as a `user`
         (not admin) returns a 403, confirming the API-level lock
   - [ ] Site is usable on your phone in both themes

## Ongoing use

Nothing else to maintain: Excel (and your existing VBA) stays the
master record, an HSE admin re-uploads the latest `.xlsm` at `/upload`
whenever they want the site refreshed, and the site recalculates
everything else (Expiring Soon, the dashboard widgets) on every page
load — no rebuild needed for new data. New staff accounts are added
the same way as your own (step 3 above), left at the default `user`
role unless they also need upload access.
