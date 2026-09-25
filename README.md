# Permit Log Register — Web Dashboard

Read-only work permit monitoring site for the SWWS Salalah permit log.
Excel remains the master record. This site never writes back to it.

## Step 1 of 8: project skeleton ✅

Confirmed working — the site deploys and hosting is set up.

## Step 2 of 8: Vercel Blob storage + upload page ✅

## Step 3 of 8: reading the Excel file ✅

## Step 4 of 8: the Expiring Soon rule ✅

## Step 5 of 8: the Dashboard page ✅

## Step 6 of 8: the Permit List page

This makes the **Permit List** nav link work: a searchable, filterable
table of every permit.

- **Search** matches: Reference, Location, Job Description, Applicant,
  Holder, Issuer, Area Authority, Controller.
- **Filters:** Status (using the same Expiring Soon-aware status as
  the dashboard), Area, and Permit Type — each filter's dropdown
  options are built from whatever values actually exist in your
  workbook, so it stays accurate as your data changes.
- Table is horizontally scrollable on narrow/mobile screens rather
  than squeezing columns unreadably small.
- Clicking a row doesn't do anything yet — that's Step 7, when the
  Permit Details page exists to link to.

### Deploy and test

1. Replace the files in your repo with this version. New:
   `app/permits/page.js`, `app/components/PermitTable.js`,
   `app/components/StatusBadge.js`. Changed: `app/globals.css` (added
   table/filter styles).
2. Wait for Vercel to redeploy.
3. Visit `your-site.vercel.app/permits`. You should see all 32
   permits in a table.
4. Try the search box (e.g. search a location or applicant name) and
   each filter dropdown, and confirm the table narrows correctly.
5. On your phone, or by narrowing your browser window, confirm the
   table scrolls sideways instead of breaking the page layout.

Reply once that looks right and we'll move to Step 7: the Permit
Details page.
