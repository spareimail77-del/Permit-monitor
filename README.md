# Permit Log Register — Web Dashboard

Read-only work permit monitoring site for the SWWS Salalah permit log.
Excel remains the master record. This site never writes back to it.

## Step 1 of 8: project skeleton ✅

Confirmed working — the site deploys and hosting is set up.

## Step 2 of 8: Vercel Blob storage + upload page ✅

## Step 3 of 8: reading the Excel file

This adds a read-only API endpoint at `/api/permits` that opens the
stored file and pulls out every permit row (columns A–Q), exactly as
written, plus your existing Excel Status column. Nothing is
recalculated yet — that's Step 4 (Expiring Soon). There's still no
visual dashboard yet — that's Step 5 onward.

Notes on how it reads the file:
- It looks for a sheet whose name starts with `SWWS-PERMITS` (so it
  still works if you rename the tab to a new year, e.g.
  `SWWS-PERMITS - 2027`).
- Data is read starting at row 6, stopping once it hits a run of
  blank rows — so adding new permit rows in Excel just works, no
  code change needed.
- Dates are read as plain calendar dates (e.g. `2026-09-30`), not
  converted between timezones, so they always match what's typed in
  Excel.

### Deploy and test

1. Replace the files in your GitHub repo with this version (adds
   `app/api/permits/route.js`, `lib/parsePermits.js`,
   `lib/permitColumns.js`, and one new dependency).
2. Wait for Vercel to redeploy.
3. Visit `your-site.vercel.app/api/permits` directly in your browser.
   You should see raw JSON listing your permit rows — reference
   numbers, dates, status, etc. (This is a technical check, not the
   real dashboard — it's expected to look like plain text/data.)
4. If you see an error instead, it'll say one of:
   - `No permit file has been uploaded yet` → go upload one at `/upload`
   - `Could not retrieve the stored file` → try re-uploading
   - `The uploaded file could not be read as an Excel workbook` →
     confirm the file is the real `.xlsm`, not renamed/corrupted
   - `Could not find a sheet named like "SWWS-PERMITS..."` → check
     the sheet tab name in Excel

Reply once you see your permit data in that JSON (or tell me what
error/output you get) and we'll move to Step 4: the Expiring Soon
rule.
