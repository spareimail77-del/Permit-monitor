# Permit Log Register — Web Dashboard

Read-only work permit monitoring site for the SWWS Salalah permit log.
Excel remains the master record. This site never writes back to it.

## Step 1 of 8: project skeleton ✅

Confirmed working — the site deploys and hosting is set up.

## Step 2 of 8: Vercel Blob storage + upload page ✅

## Step 3 of 8: reading the Excel file ✅

## Step 4 of 8: the Expiring Soon rule

This adds the one piece of status logic the website ever computes
itself: if a permit's Excel Status is `OPEN` and its Valid To date is
3 days or less away (and not yet passed), the API now also returns
`displayStatus: "EXPIRING_SOON"` for that row. Every other Excel
status (`CLOSED`, `EXPIRED`, `CANCELED`, etc.) passes straight
through unchanged as `displayStatus`.

- **Timezone:** calculated in `Asia/Muscat` (Oman, no daylight
  saving), matching the site location, regardless of where Vercel's
  servers physically run.
- Each permit in the JSON now also has a `daysRemaining` number
  (when it's OPEN and has a Valid To date) so you can see exactly how
  the boundary was calculated.
- The response also includes a top-level `today` field showing the
  exact date used for the calculation, for easy checking.

### Deploy and test

1. Replace the files in your GitHub repo with this version (adds
   `lib/status.js`, updates `app/api/permits/route.js`).
2. Wait for Vercel to redeploy.
3. Visit `your-site.vercel.app/api/permits` again. Each permit object
   should now include `displayStatus` and `daysRemaining`, and the
   top of the response shows `today`.
4. Sanity check: find a permit whose Valid To date is within 3 days
   of `today` and whose Excel status is OPEN — it should show
   `"displayStatus": "EXPIRING_SOON"`. One further out should still
   show `"displayStatus": "OPEN"`.

Reply once that looks right and we'll move to Step 5: the Dashboard
page (the first real visual screen).
