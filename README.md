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
| Root | Everything |
| Manager | View everything (incl. archive); approve requests (later step) |
| HSE | View, upload Excel, add/remove attachments, view archive |
| Permit holder | View dashboard and permits |
| Permit applicant | View dashboard and permits |

Each account also has a **status**: `pending`, `active` or `disabled`. Only
`active` accounts can sign in; pending/disabled ones are refused at login and
signed out on their next request.

People sign in with **Staff ID + password**. Supabase needs an email, so each
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
6. Push this folder to your GitHub repo; Vercel redeploys automatically.

**Adding a user by hand:** Authentication → Users → Add user (same email
pattern, Auto Confirm), then set `role` and `display_name` in the
`profiles` table. New accounts default to `permit_holder`, `active`.

## How it works

- **Upload (Admin → Upload Data):** replaces the single current Excel in
  Vercel Blob. Root and HSE only.
- **Permit archive:** on each upload the new file is compared with the one on
  the site. Any permit number that disappeared is saved to `archived_permits`
  (one row per permit number, so daily uploads never duplicate; only removed
  permits are stored). A file with no permits is rejected. Viewable at
  Admin → Permit Archive by Root, HSE and Manager. A permit that later
  returns to the Excel also stays in the archive.
- **Attachments:** files (Physical Permit, JSA, etc.) are stored in
  Cloudinary and linked to the permit number in Supabase, so they survive
  re-uploads and remain visible on archived permits. Opened through short-lived
  signed links. Root and HSE add/remove; everyone signed in can view.

## Known caveat

The Blob store is public: the raw `.xlsm` can be fetched by anyone who has its
exact URL, independent of the login. Fixing it means a new private store or
moving the file to Supabase Storage.

## Roadmap

- Step 22: Create account and Forgot password (no email), Change password.
- Step 23: User management in Admin (approve/reject, roles, disable, reset,
  delete).
