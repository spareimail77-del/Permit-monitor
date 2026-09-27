# Permit Log Register — Web Dashboard

Read-only work permit monitoring site for the SWWS Salalah permit log.
Excel remains the master record. This site never writes back to it.

## Authentication & roles

The whole site now requires a real login — there is no public page
anymore, including the dashboard. Accounts and sessions are handled
by **Supabase Auth** (free tier), not by this app's own code, so there's
no password storage or session logic to maintain here.

Staff sign in with their **staff ID** (e.g. `18489`), not an email —
see "Logging in with a staff ID" below for how that works under the
hood. Real personal email is stored separately, for communication
only, and is never used to sign in.

- **`user` role** — can view the dashboard, the permit list, and permit
  detail pages. No upload access.
- **`admin` role** — everything a `user` can do, plus `/upload`.

Roles live in a `profiles` table in Supabase Postgres (see
`supabase-schema.sql`), one row per account, with a `role` column and
an empty `permissions` jsonb column reserved for finer-grained flags
you add later — adding a new permission won't require touching the
auth flow again, just checking that field where it matters.

There is **no self-signup** — accounts are created by you from the
Supabase dashboard, and default to `role = 'user'` via a database
trigger. Promote an account to admin with one SQL statement (see
`supabase-schema.sql`, step 3).

Enforcement happens in two places, deliberately redundant:
`middleware.js` (blocks every request before it reaches a page or
API route) and the `/upload` page and `/api/upload` route themselves
(re-check independently, so the lock holds even if the middleware
config ever changes).

### Logging in with a staff ID

Supabase Auth is built around email + password; it has no separate
"username" field. So each staff ID maps to a synthetic, never-emailed
address like `18489@staff.permit-log.internal` — that's what's
actually stored as the Supabase login email, and the login page
converts what someone types into that address behind the scenes
(`lib/staffAuth.js`). Their real email lives in `profiles.email` purely
for you to contact them; it's disconnected from login entirely.

One consequence: Supabase's built-in "forgot password" email flow
won't reach anyone, since the login address isn't real. For now, reset
a forgotten password yourself from Supabase Dashboard → Authentication
→ Users → (person) → reset password.

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
3. **Create your own account**: Authentication → Users → Add user.
   For **Email**, enter `<your staff id>@staff.permit-log.internal`
   (e.g. `18489@staff.permit-log.internal`) — this is never emailed to
   anyone, it's just Supabase's required login field. Pick any
   password. Then in the SQL Editor:
   ```sql
   update public.profiles
      set email = 'you@company.com', role = 'admin'
    where staff_id = '18489';
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
   - [ ] Wrong staff ID/password is rejected; your admin account signs
         in with its staff ID
   - [ ] Signed in as `admin`: the "Upload" link is visible, `/upload`
         shows the upload form, and uploading a fresh `.xlsm` updates
         the dashboard
   - [ ] A second account with `role = 'user'` (create one the same
         way, leave its role as `user`) can see the dashboard/permit
         list but has no "Upload" link, and `/upload` redirects it away
   - [ ] "Sign out" returns you to `/login` and re-locks everything
   - [ ] Calling `/api/upload` directly while signed in as a `user`
         (not admin) returns a 403, confirming the API-level lock
   - [ ] Light mode reads as teal/green accented, dark mode stays
         violet
   - [ ] Site is usable on your phone in both themes, and scrolling on
         the login/upload pages no longer visibly resizes the card

## Ongoing use

Nothing else to maintain: Excel (and your existing VBA) stays the
master record, an HSE admin re-uploads the latest `.xlsm` at `/upload`
whenever they want the site refreshed, and the site recalculates
everything else (Expiring Soon, the dashboard widgets) on every page
load — no rebuild needed for new data. New staff accounts are added
the same way as your own (step 3 above), left at the default `user`
role unless they also need upload access.

## Step 12 — Attachments storage setup (Backblaze B2)

Permit attachments (scanned Physical Permit, JSA) are stored in
Backblaze B2, not Supabase or Vercel Blob — B2's free tier (10GB
storage, no credit card needed, free egress up to 3x your stored
data/month) comfortably covers ~300 permits' worth of 10-20MB files,
which the other two free tiers don't, and unlike Cloudflare R2 it
doesn't ask for a payment method to activate. Files are never
publicly linkable: the app generates a short-lived signed link
(valid 5 minutes) each time someone clicks to open one.

One-time setup:
1. Create a free account at [backblaze.com/cloud-storage](https://www.backblaze.com/cloud-storage)
   ("Get Started Free" — no credit card required). Then in the
   B2 dashboard, **Create a Bucket** (any name, e.g.
   `permit-attachments`), set it to **Private**.
2. Open the bucket you just made and note the **Endpoint** shown on
   its details page — it looks like `s3.us-west-004.backblazeb2.com`
   (the region code in the middle varies, copy it exactly).
3. Go to **Application Keys** → **Add a New Application Key**. Name
   it anything, restrict it to the one bucket you created, allow
   **Read and Write**. Backblaze shows you a **keyID** and
   **applicationKey** once — copy both immediately.
4. In Vercel → your Project → Settings → Environment Variables, add:
   - `B2_KEY_ID` (the keyID from step 3)
   - `B2_APPLICATION_KEY` (the applicationKey from step 3)
   - `B2_BUCKET_NAME` (the bucket name from step 1)
   - `B2_ENDPOINT` (the endpoint from step 2, e.g.
     `s3.us-west-004.backblazeb2.com`)
5. In Supabase SQL Editor, re-run `supabase-schema.sql` (safe to
   re-run — it only adds the new `permit_attachments` table this
   time).
6. Push the code, redeploy, and test: open a permit as an admin,
   attach a small PDF under each of "Physical Permit" and "JSA", open
   it back from the link, then try the same page as a non-admin
   account — they should see the same files (view/download works)
   but no upload form and no "Remove" button.
