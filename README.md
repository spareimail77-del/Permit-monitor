# Permit Log Register

Read-only work permit dashboard for the SWWS Salalah permit log. Excel stays
the master record; this site never writes back to it. HSE re-uploads the
`.xlsm` whenever the data changes, and the site recalculates everything
(dashboard, Expiring Soon, breakdowns) on each page load.

**Stack (all free tiers):** Next.js on Vercel · Supabase (login + database) ·
Vercel Blob (the current Excel) · Cloudinary (attachment files).

## Roles

Defined in one file: `lib/permissions.js`. Change a role's rights there, and
keep the policies in `supabase-schema.sql` in step.

| Role | Can do |
|---|---|
| Root | Everything, incl. password resets, the activity log, archive clean-up and Excel export |
| Manager | View everything (incl. archive); approve or reject account requests |
| HSE | View, upload Excel, add/remove attachments, archive clean-up, Excel export, view the activity log (read-only; Root's own visits are hidden from HSE) |
| Permit holder | View dashboard and permits |
| Permit applicant | View dashboard and permits |

Each account also has a **status**: `pending`, `active` or `disabled`. Only
`active` accounts can sign in; pending/disabled ones are refused at login and
signed out on their next request.

People sign in with **Staff ID + password**. New people use **Create account**
(ordinary user, status `pending` until approved; only Root can give a higher role); forgotten passwords go through **Forgot
password** (no email: the request appears in Admin → Password requests, and
Root sets a temporary password that must be changed at next sign-in). Anyone
signed in can use **Change password** from the user menu. Supabase needs an email, so each
staff ID maps to a never-emailed address such as
`18489@staff.permit-log.internal` (`lib/staffAuth.js`). No SMTP is used.

## Setup

1. **Supabase:** create a project; in SQL Editor run all of
   `supabase-schema.sql` (safe to re-run). Under Authentication, turn off
   "Allow new users to sign up" and "Confirm email".
2. **Create your account:** Authentication → Users → Add user, email
   `<staff id>@staff.permit-log.internal`, any password, tick **Auto Confirm
   User**. Then make yourself root (statement is in the schema file):
   `update public.profiles set role = 'root' where staff_id = '<staff id>';`
3. **Vercel Blob:** create a Blob store in your Vercel project (it adds
   `BLOB_READ_WRITE_TOKEN` automatically).
4. **Cloudinary:** create a free account and copy its credentials.
5. **Vercel environment variables:**
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     (Supabase → Project Settings → API)
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API →
     `service_role`). **Server only, secret** — never add `NEXT_PUBLIC_`.
6. Push this folder to your GitHub repo; Vercel redeploys automatically.

**Adding a user by hand:** Authentication → Users → Add user (same email
pattern, Auto Confirm), then set `role` and `display_name` in the
`profiles` table. New accounts default to `permit_holder`, `active`.

## How it works

- **Users (Admin → Users):** Root sees everyone and can approve/reject
  requests, change roles, disable/enable, reset a password (temporary
  password shown once, changed at next sign-in) and delete accounts. Manager
  sees only pending requests and can approve or reject them. Rules enforced
  on the server: you cannot change, disable or delete your own account, and
  the last active Root can never be demoted, disabled or deleted.

- **Activity log (Admin → Activity; Root and HSE can view, only Root can change retention):** one small row per page
  visit (staff ID, page path, time; no IP or form contents). A visit is
  written only when someone opens a different page or 3+ minutes have passed;
  prefetches and API calls are ignored. Kept for 3, 5 or 7 days (Root
  chooses); expired rows are deleted by the database function itself, no cron.
  The page groups visits by the same person less than 30 minutes apart into
  sessions (click one for its timeline), with friendly page names, day
  headings, a summary strip, a visits-per-day bar chart and filters (date,
  page type, person, hide my own visits). It reads the newest 2,000 rows in
  one query; everything else runs in the browser, no polling.
  Admin → Users shows a green check for anyone active in the last 5 minutes,
  otherwise "last seen …". Nothing refreshes by itself (no heartbeat): use
  **Check again**.
- **Upload (Admin → Upload Data):** replaces the single current Excel in
  Vercel Blob. Root and HSE only.
- **Permit archive:** on each upload the new file is compared with the one on
  the site. Any permit number that disappeared is saved to `archived_permits`
  (one row per permit number, so daily uploads never duplicate; only removed
  permits are stored). A file with no permits is rejected. Viewable at
  Admin → Permit Archive by Root, HSE and Manager. A permit that later
  returns to the Excel also stays in the archive.
  Root and HSE can filter (search, area, type, status, archived date range,
  valid-to range, sort), tick rows or **select all matching** across pages,
  and permanently delete them together with their attachments (batches of 25;
  more than a page needs a typed `DELETE n` confirmation).
- **Export to Excel (Root and HSE):** a button on the Permit List (rows
  currently shown) and on the Archive (ticked rows, or everything matching the
  filters). The `.xlsx` is built in the browser using the master log's header
  block and column layout, with the site's calculated status and days left; no
  macros. Exported files carry a marker and the upload refuses them, so a
  filtered export can't replace the master log by accident.
- **Attachments:** files (Physical Permit, JSA, etc.) are stored in
  Cloudinary and linked to the permit number in Supabase, so they survive
  re-uploads and remain visible on archived permits. Opened through short-lived
  signed links. Root and HSE add/remove; everyone signed in can view.

- **Abuse protection:** account requests and forgot-password requests are
  rate-limited per IP and per day (table `rate_limits`), capped at 40 pending
  requests, and use a hidden bot-trap field. Nothing here sends email.

## Known caveat

The Blob store is public: the raw `.xlsm` can be fetched by anyone who has its
exact URL, independent of the login. Fixing it means a new private store or
moving the file to Supabase Storage.

## Roadmap

Nothing planned.
