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
| Root | Everything, incl. the **only** right to accept new accounts and Staff ID changes, password resets, the activity log, archive clean-up and Excel export |
| Manager | View everything (incl. archive), read-only. Cannot accept accounts or Staff ID changes |
| HSE | View, upload Excel, add/remove attachments, archive clean-up, Excel export, view the activity log (read-only; Root's own visits are hidden from HSE) |
| Permit user | View dashboard and permits (applicants, holders, or both: that is per permit, from the Excel columns, not an account role) |

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
`profiles` table. New accounts default to `permit_user`, `active`.

## How it works

- **Users (Admin → Users):** Root sees everyone and can approve/reject
  requests, change roles, disable/enable, reset a password (temporary
  password shown once, changed at next sign-in) and delete accounts. Only Root can accept or reject account requests (checked in
  middleware, the page and the API route). Rules enforced
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
- **Upload order (step 44):** the upload route works in a safe order: (1) check the
  file (a bad file is refused and nothing changes), (2) compare it with the file
  on the site now, (3) save the new Excel file, (4) only then update the archive,
  (5) write the upload log. If saving the Excel file fails, the archive is not
  touched, so the archive and the live dashboard can never disagree. If the
  archive fails after the file is saved, the upload still counts, a warning is
  shown and logged, and the next upload repairs the archive (it compares with the
  archive, not with the previous file). A file that cannot be read as a workbook
  is now refused instead of uploaded. No database change.

- **Permit archive (step 39):** on each upload every **new or changed** permit is
  copied into `archived_permits` (one row per permit number; unchanged permits
  are not written, so it stays small). The new file is compared with the archive,
  not with the previous file, so a wrong upload can't lose anything and the next
  good upload repairs the archive. A permit missing from the file is never
  deleted: it is marked `in_log = false` with the date it left the log, and turns
  back on if it returns. A file with no permits is rejected. Admin → Permit
  Archive (Root, HSE, Manager) shows "No longer in the log" by default; switch
  **Show** to "Still in the log" or "All permits". Permits still in the log
  cannot be deleted from the archive. If the archive can't be updated, the
  upload still goes through and says so.
  Root and HSE can filter (search, area, type, status, left-the-log date range,
  valid-to range, sort), tick rows or **select all matching** across pages,
  and permanently delete them together with their attachments (batches of 25;
  more than a page needs a typed `DELETE n` confirmation).
- **Export to Excel (Root and HSE):** a button on the Permit List (rows
  currently shown) and on the Archive (ticked rows, or everything matching the
  filters). The `.xlsx` is built in the browser from a **copy of the real master
  log** (step 45, `lib/exportMaster.js`): the browser fetches the current master
  file, keeps everything that makes it look right (logos, fonts, merged
  headings, column widths, row heights, colour rules, dropdown lists) and
  rewrites only the permit rows from row 6, using the master's own row style.
  Macros and the hidden ActiveX control are removed, so it is a clean `.xlsx`.
  The **Status** column uses the log's own words: Open and Expiring soon are
  `OPEN`, Overdue is `EXPIRED`, Closed is `CLOSED` (the log's colour rules look
  for these). **Days to Go** is not exported (the column is hidden), and
  multi-line cells (certificates) are tidied to single line breaks. The JSZip
  library (loaded only when someone clicks Export) opens and closes the file. If the
  master file can't be fetched or opened, the older plain export (header block
  and column layout only, no styling) is downloaded instead. Exported files
  carry a marker and the upload refuses them, so a filtered export can't replace
  the master log by accident.
- **Attachments:** files (Physical Permit, JSA, etc.) are stored in
  Cloudinary and linked to the permit number in Supabase, so they survive
  re-uploads and remain visible on archived permits. Opened through short-lived
  signed links. Root and HSE add/remove; everyone signed in can view.

- **My profile (user menu):** everyone can correct their own **name**
  straight away. A different **Staff ID** is a request
  (`staff_id_change_requests`) that only Root approves in
  **Admin → Staff ID changes**. Approving switches the login address to the new
  ID and runs `apply_staff_id_change()` (SQL, all or nothing) which updates the
  profile and rewrites the old ID in the activity log, password requests and
  upload log; attachments and archived permits follow automatically because
  they point to the account's internal id. If the database step fails, the login
  address is switched back. The person stays signed in and uses the new ID at
  their next sign-in. Rules: one open request per person, 3 requests per day, the
  new ID must be free, and only Root may decide their own request.

- **Upload log (Upload page):** every upload attempt is recorded in
  `upload_log` (who, file name, size, permits in the file, result, time in Oman
  time); rejected files are logged with the reason. Step 40 adds what each
  upload changed compared with the file on the site before it: permits
  **added**, **updated** (with the fields that changed, old → new) and
  **removed**, shown as `+added ~updated −removed` with a Details button
  (counts are exact; lists keep at most 100 permits per group; the daily
  "days to go" text and row numbers don't count as changes). The first upload
  has no previous file, so it has no change details. The page shows the file now on the site and the history (latest 100,
  12 at a time). Visible to Root and HSE.

- **Drop-zone file fields (step 41):** the Excel upload and the permit
  attachment upload use one shared field (`app/components/DropZone.js`): drag a
  file onto it, or click it (or press Enter / Space) to open the file explorer.
  It shows the chosen file name and size with Replace and Remove, and explains a
  wrong file type or size. The Excel field checks the 4.4 MB size in the browser
  because Vercel's free plan refuses larger request bodies; attachments keep
  their rules (10 MB; step 42 adds PNG and photo compression). No database change.

- **Photo compression (step 42):** when a JPEG or PNG is chosen as an attachment,
  the browser re-saves it as a smaller JPEG (canvas only, no library, no server
  work; code in `lib/compressImage.js`). A "before → after" size is shown with a
  quality **slider** (40–95%, default 60%) and a "Keep the original" tick
  box (JPEG only); moving the slider always starts again from the original
  file. Same pixel size, except photos with a side over 4096 px are
  scaled down (so old phones don't run out of memory). Rotation is kept; GPS and
  other hidden camera data are dropped. PNG is converted to JPEG on a white
  background. PDFs are never changed. An already-small JPEG that would grow is
  kept as it is. The 10 MB Cloudinary limit is checked on the compressed file.
  HEIC files the browser can't open show an iPhone tip (Settings > Camera >
  Formats > Most Compatible). The server code is unchanged (it already accepts
  `image/jpeg`). No database change.

- **Photo crop with four corners (step 43):** a **Crop photo** button opens the
  photo with four dots (`app/permits/[rowNumber]/CropEditor.js`, canvas only, no
  library). Each corner moves on its own, so a page photographed at an angle can
  be marked exactly; drag inside the shape to move all four, or Tab to a corner
  and use the arrow keys. While a corner is dragged a magnifier shows what is
  under the finger. If the corners cross over or bend inward the shape turns red
  and Apply stays off. **Apply** cuts the marked area out and straightens it into
  a rectangle (a perspective transform done pixel by pixel in
  `lib/compressImage.js`, in bands so the page stays responsive; the result is
  limited to 3500 px on its longest side). If the four dots form an upright
  rectangle it is a plain, sharper crop instead. The cut-out is kept in memory so
  moving the quality slider afterwards is instant. The panel shows the new pixel
  size and the before → after file size; **Edit crop** reopens the corners and
  **Remove crop** goes back to the whole photo. A crop switches "Keep the
  original" off. No database change.

- **My permits (step 36):** the Excel log picks Applicant and Holder from
  dropdown lists. In **Admin → People & Excel names** (Root and HSE) each name
  from those lists is linked to an account (`excel_name_links`; one Excel name
  belongs to one account, an account can own several names). Close spellings are
  offered as a one-click suggestion. A linked person gets: a **My permits**
  panel at the top of the dashboard (active, expiring soon, overdue, closed;
  holder/applicant split; the permits needing action first), a **My permits /
  As holder / As applicant** switch on the Permit List (`?mine=1`), a coloured
  tag (Holder, Applicant, or Both) on their permits, and a tag on the permit
  page. Everyone still sees every permit; only the highlighting is personal.
  Accounts with no linked name get a short hint on the dashboard. Names are
  compared in upper case with single spaces; several names in one cell can be
  separated with comma, slash, ampersand or semicolon.

- **My profile (step 37):** one page with three tabs in the address
  (`/profile`, `?tab=security`, `?tab=preferences`); only the open tab loads its
  data. *Overview:* My permits snapshot, Details (name edit in place, Staff ID
  change request, role, linked Excel names), Your access (plain-language list
  built from `lib/permissions.js`) and, for Root/HSE, the person's last uploads.
  *Security:* Change password (moved here from the menu) and Sign out on all
  devices. *Preferences:* theme (Dark / Light / Follow my device) and "open the
  Permit List on My permits"; both are saved on the device (no database
  change). `/change-password` now only serves the forced change after a
  temporary password; otherwise it redirects to the Security tab.

- **Sign-in loader:** after a successful sign-in a full-screen loader
  (`app/components/SignInLoader.js`, mounted once in `app/layout.js`) covers the
  screen until the dashboard content has arrived, then fades out as the cards
  rise in. Theme colours only (violet dark, teal light); respects reduced
  motion (it stays but holds still).

- **Speed:** the permit file is downloaded and parsed once per upload and
  shared by all server instances (Vercel Data Cache, `lib/parsePermits.js`);
  the upload clears it at once. Signed-in checks avoid a Supabase round trip
  where possible (`lib/supabase/user.js`: middleware, the header lookup and
  read-only pages; routes that change data still use `getUser()`). The header
  remembers the signed-in person's name/role for 5 minutes per tab.

- **Abuse protection:** account requests and forgot-password requests are
  rate-limited per IP and per day (table `rate_limits`), capped at 40 pending
  requests, and use a hidden bot-trap field. Nothing here sends email.

## Known caveat

The Blob store is public: the raw `.xlsm` can be fetched by anyone who has its
exact URL, independent of the login. Fixing it means a new private store or
moving the file to Supabase Storage.

## Roadmap

Nothing planned.
