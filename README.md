# Permit Log Register — Web Dashboard

Read-only work permit monitoring site for the SWWS Salalah permit log.
Excel remains the master record. This site never writes back to it.

## Step 1 of 8: project skeleton ✅

Confirmed working — the site deploys and hosting is set up.

## Step 2 of 8: Vercel Blob storage + upload page ✅

## Step 3 of 8: reading the Excel file ✅

## Step 4 of 8: the Expiring Soon rule ✅

## Step 5 of 8: the Dashboard page ✅

## Step 6 of 8: the Permit List page ✅

## Step 7 of 8: the Permit Details page

Clicking any row in the Permit List now opens a read-only detail page
for that permit at `/permits/<reference>`, grouped into Overview,
Validity, Job Details, and People. It shows both the website's
computed status (with Expiring Soon applied) and the raw Excel Status
column side by side, so it's always clear which is which.

### Deploy and test

1. Replace the files in your repo with this version. New:
   `app/permits/[reference]/page.js`, `app/components/DetailField.js`.
   Changed: `app/components/PermitTable.js` (rows are now clickable),
   `app/globals.css` (added detail-page styles).
2. Wait for Vercel to redeploy.
3. Go to `/permits`, click any row, and confirm it opens that
   permit's details correctly.
4. Try visiting a made-up reference directly, e.g.
   `your-site.vercel.app/permits/doesnotexist` — you should see a
   clean "Permit not found" message, not a broken page.

Reply once that looks right and we'll move to Step 8: mobile polish,
error handling review, and final deployment checks.
