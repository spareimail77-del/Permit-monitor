# Permit Log Register — Web Dashboard

Read-only work permit monitoring site for the SWWS Salalah permit log.
Excel remains the master record. This site never writes back to it.

## Authentication & roles

The whole site requires a real login — there is no public page,
including the dashboard. Accounts and sessions are handled by
**Supabase Auth** (free tier), not by this app's own code, so there's
no password storage or session logic to maintain here.

Staff sign in with their **staff ID** (e.g. `18489`), not an email —
see "Logging in with a staff ID" below for how that works under the
hood. Real personal email is stored separately, for communication and
account recovery only, and is never used to sign in.

- **`user` role** — can view the dashboard, the permit list, and permit
  detail pages. No upload access.
- **`admin` role** — everything a `user` can do, plus `/upload`.

Roles live in a `profiles` table in Supabase Postgres (see
`supabase-schema.sql`), one row per account, with a `role` column and
an empty `permissions` jsonb column reserved for finer-grained flags
you add later.

**Accounts are self-serve** — anyone can create their own at
`/signup`. New accounts default to `role = 'user'`. Promote one to
admin with one SQL statement (see `supabase-schema.sql`, step 3).

Enforcement happens in two places, deliberately redundant:
`middleware.js` (blocks every request before it reaches a page or
API route) and the `/upload` page and `/api/upload` route themselves
(re-check independently, so the lock holds even if the middleware
config ever changes).

### Signing up

At `/signup`, someone enters a staff ID, their real company email, and
a password. Two things happen:

1. The account is created under their **real company email** — that's
   the only address Supabase's own (free) mailer can actually deliver
   to — and Supabase sends them a confirmation link.
2. Once they click it, the site automatically swaps that account's
   login email over to a synthetic, never-emailed address like
   `18489@staff.permit-log.internal`. From that point on they sign in
   with their staff ID, and their real email is kept in `profiles.email`
   purely for your reference — it's disconnected from login entirely.

Staff IDs must be unique; the signup form checks availability before
creating the account.

### Forgot password

At `/forgot-password`, someone enters their real company email and
gets a 6-digit code by email, then picks a new password. Under the
hood this uses the same "the account's login email must be real for
Supabase's mailer to reach it" idea as signup: the account's email is
briefly pointed at the real address so Supabase can send the code,
then pointed back at the synthetic staff-ID address the moment the
reset finishes. This is fully self-contained in the app — no separate
email service to sign up for.

**One-time setup this needs, done once in the Supabase Dashboard, free:**
Authentication → Emails → "Reset Password" template — add `{{ .Token }}`
somewhere in the body. That's what makes the email show a 6-digit code
instead of only a magic link. (See `supabase-schema.sql` for the exact
note and a manual recovery SQL snippet, in the rare case someone
abandons a reset halfway through.)

### Logging in with a staff ID

Supabase Auth is built around email + password; it has no separate
"username" field. So, permanently after signup completes, each staff
ID maps to a synthetic address like `18489@staff.permit-log.internal`
— that's what's actually stored as the Supabase login email, and the
login page converts what someone types into that address behind the
scenes (`lib/staffAuth.js`).

### Your own account / manual accounts

You can still add an account by hand from the Supabase dashboard (as
before) instead of using `/signup` — see `supabase-schema.sql` step 3
for the exact SQL to fill in its real email and role afterward. This
is the route to take for your **very first** admin account, since
nobody can promote themselves to admin through `/signup`.

## User menu

Every signed-in page shows a small user icon in the top-right of the
header (next to the theme switch). Click it for staff ID, role, real
email, and "Sign out" — this replaced a separate, oddly-placed sign-out
button that used to live only on the Upload page.

## What changed in this update

**1. Self-serve signup + forgot password (OTP)**
See "Authentication & roles" above. Requires one new environment
variable — `SUPABASE_SERVICE_ROLE_KEY` — see the deploy checklist.

**2. User menu**
Sign out (and, at a glance, staff ID / role / email) now lives in one
consistent place in the header, on every page, instead of a bare
button bolted onto Upload.

**3. Light-mode fix**
A button glow (`.btn-primary`'s shadow) was hardcoded to the dark
theme's violet instead of following the theme, so light mode kept a
faint purple cast. It now uses a theme-aware variable — light mode is
fully teal-accented, no violet left over.

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
2. **Leave "Allow new users to sign up" ON** (Authentication →
   Providers/Settings) — that's what powers self-serve `/signup` now.
   **Confirm "Confirm email" is ON** too (it's Supabase's default) —
   this is what stops an account from being usable before its company
   email is verified.
3. **Add the OTP token to the Reset Password email template**:
   Authentication → Emails → "Reset Password" → add `{{ .Token }}`
   somewhere in the body, so the email shows a 6-digit code.
4. **Create your first (admin) account**: Authentication → Users →
   Add user. For **Email**, enter `<your staff id>@staff.permit-log.internal`
   (e.g. `18489@staff.permit-log.internal`) — this is never emailed to
   anyone, it's just Supabase's required login field. Pick any
   password. Then in the SQL Editor:
   ```sql
   update public.profiles
      set email = 'you@company.com', role = 'admin'
    where staff_id = '18489';
   ```
   Everyone else can just use `/signup` once the site is live.
5. **Get your API keys**: Project Settings → API → copy the Project
   URL, the `anon` `public` key, and the **`service_role`** **secret**
   key (new — needed for signup/reset; never expose this in browser
   code).
6. **Replace your GitHub repo's files** with everything in this
   folder (keep the same repo/project so your existing Blob store
   stays connected). `node_modules` and `.next` are intentionally not
   included — Vercel builds those itself.
7. **Add environment variables** in Vercel → your Project → Settings →
   Environment Variables (apply to Production, and Preview/Development
   if you use them):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — server-only, do **not** add a
     `NEXT_PUBLIC_` prefix
8. **Push to GitHub.** Vercel will redeploy automatically if it's
   connected to the repo.
9. **Re-test the checklist:**
   - [ ] Visiting the site in a private/incognito window redirects to
         `/login`, not the dashboard
   - [ ] `/signup` creates an account, sends a confirmation email to
         the real company email, and clicking it lands you back on
         `/login` with a "confirmed" message
   - [ ] Signing in right after signup works with the **staff ID**,
         not the company email
   - [ ] `/forgot-password` emails a 6-digit code to the real company
         email, and entering it + a new password lets you sign in with
         the new password (still via staff ID)
   - [ ] Wrong staff ID/password is rejected; your admin account signs
         in with its staff ID
   - [ ] Signed in as `admin`: the "Upload" link is visible, `/upload`
         shows the upload form (no stray sign-out button here anymore),
         and uploading a fresh `.xlsm` updates the dashboard
   - [ ] A second `user`-role account can see the dashboard/permit list
         but has no "Upload" link, and `/upload` redirects it away
   - [ ] The user icon in the header shows staff ID/role/email and
         signs you out cleanly, re-locking everything
   - [ ] Calling `/api/upload` directly while signed in as a `user`
         (not admin) returns a 403, confirming the API-level lock
   - [ ] Light mode reads as fully teal/green accented — no leftover
         purple glow on buttons — and dark mode stays violet
   - [ ] Site is usable on your phone in both themes

## Ongoing use

Nothing else to maintain: Excel (and your existing VBA) stays the
master record, an HSE admin re-uploads the latest `.xlsm` at `/upload`
whenever they want the site refreshed, and the site recalculates
everything else (Expiring Soon, the dashboard widgets) on every page
load — no rebuild needed for new data. New staff create their own
accounts at `/signup`, left at the default `user` role unless you
promote them (`supabase-schema.sql`, step 3).
