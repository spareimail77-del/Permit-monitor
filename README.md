# Permit Log Register — Web Dashboard

Read-only work permit monitoring site for the SWWS Salalah permit log.
Excel remains the master record. This site never writes back to it.

## Step 1 of 8: project skeleton ✅

Confirmed working — the site deploys and hosting is set up.

## Step 2 of 8: Vercel Blob storage + upload page ✅

## Step 3 of 8: reading the Excel file ✅

## Step 4 of 8: the Expiring Soon rule ✅

## Step 5 of 8: the Dashboard page

This replaces the placeholder home page with the real dashboard:
summary counts for Total, Active/Open, Expiring Soon, Expired,
Closed, and Canceled, plus a "Data as of" line showing when the file
was last uploaded and what date was used for the calculation.

There's also now a shared header with navigation across pages
(Dashboard / Permit List / Upload). The **Permit List** link won't
work yet — that's built in Step 6, so it'll 404 until then.

### Deploy and test

1. Replace the files in your GitHub repo with this version. Changed:
   `app/page.js` (rewritten), `app/upload/page.js` (now reuses the
   shared header). New: `app/components/Header.js`,
   `app/components/StatCard.js`, `app/components/ErrorScreen.js`,
   `lib/statusMeta.js`.
2. Wait for Vercel to redeploy.
3. Visit `your-site.vercel.app` — you should see the real dashboard
   with your permit counts, not the old "skeleton deployed" message.
4. Check the counts by eye against what you know of your permit log
   (e.g. total should be 32 if nothing's changed since upload).

Reply once the dashboard looks right and we'll move to Step 6: the
searchable, filterable Permit List.
