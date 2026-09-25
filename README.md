# Permit Log Register — Web Dashboard

Read-only work permit monitoring site for the SWWS Salalah permit log.
Excel remains the master record. This site never writes back to it.

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

**3. Upload locked to HSE**
`/upload` now shows a passcode gate. Enter the correct passcode once
and a signed, httpOnly session cookie (12-hour expiry) unlocks the
real upload form on that browser. The `/api/upload` endpoint
independently checks the same cookie server-side, so the lock can't be
bypassed by calling the API directly — the UI gate isn't the only
thing enforcing it. There's a "Sign out" link on the upload page for
shared computers.

The passcode and the cookie-signing secret are **not in this code** —
they live only as Vercel environment variables (see step 3 below), so
they're never committed to GitHub.

**4. Housekeeping**
Bumped `next` from `14.2.5` → `^14.2.35` (the `14.2.5` line had
several CVEs patched in Next.js's December 2025 security update).

## Honest caveat on the Upload lock

This is a **shared department passcode**, not individual logins —
there's no user database, which keeps it simple and free to run.
Anyone with the passcode can upload; it can't tell which HSE person
did it. Rotate the passcode in Vercel if it's ever shared outside HSE.

Separately: your Blob store is on **public** access, meaning the raw
`.xlsm` file itself is fetchable by anyone with its exact blob URL,
independent of the upload lock above. Vercel Blob access mode can't be
changed after a store is created, so fixing that would mean creating a
new **private** store and pointing `lib/blob.js` at it — happy to do
that in a follow-up if you'd like the file itself locked down too.

## Deploy checklist

1. **Replace your GitHub repo's files** with everything in this
   folder (keep the same repo/project so your existing Blob store
   stays connected). `node_modules` and `.next` are intentionally not
   included — Vercel builds those itself.
2. **Push to GitHub.** Vercel will redeploy automatically if it's
   connected to the repo.
3. **Add two environment variables** in Vercel → your Project →
   Settings → Environment Variables (apply to Production, and
   Preview/Development if you use them):
   - `HSE_UPLOAD_PASSWORD` — the shared passcode HSE will type at
     `/upload`. Any phrase works; it doesn't need to look like a
     random token.
   - `AUTH_SECRET` — a random signing secret for the session cookie.
     Generate one locally with `openssl rand -hex 32`, or any
     32+ character random string.

   After adding both, **redeploy** (Vercel → Deployments → ⋮ → Redeploy)
   so the new functions pick them up.
4. **Re-test the checklist:**
   - [ ] Dashboard loads with the new dark theme; switch toggles to
         light and back, and persists after a refresh
   - [ ] Dashboard shows the donut chart, expiring-soon list, and
         area/type breakdowns
   - [ ] Visiting `/upload` in a private/incognito window shows the
         passcode gate, not the upload form
   - [ ] Wrong passcode is rejected; correct passcode unlocks the form
   - [ ] Uploading a fresh `.xlsm` updates the dashboard
   - [ ] "Sign out" on the upload page re-locks it
   - [ ] Calling `/api/upload` without having signed in returns
         "Not authorized" (confirms the API-level lock, not just the
         page)
   - [ ] Site is usable on your phone in both themes
   - [ ] No edit/save/delete controls exist anywhere on the dashboard
         or permit views

## Ongoing use

Nothing else to maintain: Excel (and your existing VBA) stays the
master record, HSE re-uploads the latest `.xlsm` at `/upload`
whenever they want the site refreshed, and the site recalculates
everything else (Expiring Soon, the dashboard widgets) on every page
load — no rebuild needed for new data.
