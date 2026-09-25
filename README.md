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

## Step 7 of 8: the Permit Details page ✅

## Step 8 of 8: polish, edge cases, and final checks

This last step doesn't add new pages — it hardens what's already
there, based on the error-handling checklist from the original plan:

- **Duplicate permit references:** if two rows in your workbook ever
  share the same reference number, the Dashboard and Permit List now
  show a warning banner, the duplicate is flagged with a ⚠ in the
  table, and the detail page notes it. (Permit links now use the
  workbook row number internally, not the reference, so duplicates
  can't accidentally open the wrong permit.)
- **Empty dataset:** if the uploaded file has zero permit rows, the
  Dashboard and Permit List show a clear message instead of a wall of
  zeros or a blank table.
- **OPEN permits missing a Valid To date:** flagged on the detail
  page, since Expiring Soon can't be calculated without one.
- **Mobile:** explicit viewport handling added for consistent scaling
  on phones (headers, filters, and the permit table already wrap/
  scroll correctly from earlier steps).
- **Search-engine protection:** added `robots.txt` (Disallow: /) as a
  second layer alongside the `noindex` tag from Step 1.

### Deploy and test

1. Replace the files in your repo with this final version. Changed:
   `lib/parsePermits.js`, `app/page.js`, `app/permits/page.js`,
   `app/components/PermitTable.js`, `app/layout.js`. Renamed:
   `app/permits/[reference]/` → `app/permits/[rowNumber]/`. New:
   `public/robots.txt`.
2. Wait for Vercel to redeploy.
3. Re-test the full checklist:
   - [ ] Dashboard counts match Excel
   - [ ] Search and each filter on Permit List work
   - [ ] Clicking a permit opens the right details
   - [ ] A bad `/permits/...` URL shows "Permit not found", not a crash
   - [ ] Site is usable on your phone
   - [ ] No edit/save/delete controls exist anywhere
   - [ ] Uploading a fresh Excel file updates the dashboard after
         redeploy-free refresh (no code change needed — just re-upload
         at `/upload`)

## You're done

The site is a read-only monitoring layer: Excel (and your existing
VBA) stays the master record, and the only thing the website ever
calculates itself is the Expiring Soon flag on top of your Excel
Status column. To keep it current going forward, just re-upload the
latest `.xlsm` at `/upload` whenever you want the site refreshed —
there's nothing else to maintain.
