# HSE Permits — steps A, A2, A3, B, B2, C, C2, D

The new site, built in small steps: a **permit form** that saves into the
database, a **permit list**, documents in Cloudinary, and (step B) **sign-in by
Staff ID with roles**. Rebuild plan and system reference: see "SWWS Permit Log Register — System Reference".

## What is in this step

| Page | What it does |
|---|---|
| `/login` | Sign in with Staff ID and password (step B) |
| `/profile` | Change your own name and password (step B) |
| `/` | Home, with the number of permits stored |
| `/permits/new` | The permit form (dropdowns from the database) |
| `/permits` | List of everything stored, newest first |
| `/permits/<id>` | One permit: details, certificates with numbers, documents, add a document |
| `POST /api/permits` | Checks and saves one permit |
| `POST /api/permits/<id>/files` | Records files already sent to storage (checks them again) |

Form rules: required = permit number, Area, Location, Type, Job description,
Applicant, Controller, Valid from, Valid to, and at least one certificate (or NA).
Valid to cannot be before Valid from. A permit number can be used once. A new
permit always starts OPEN.

**Validity limit (A2):** Valid to can be at most Valid from + 30 days for COLD
BLANKET, + 14 for COLD, + 7 for HOT. The latest allowed date is shown in green,
later dates are greyed out in the calendar, and a typed later date is refused
with a message (in the browser and again on the server). Shorter is allowed.

**Certificates (A2):** every ticked certificate needs its own number (and may
have its own copy). NA means none: its number is saved as NA and nothing else
can be ticked with it. Stored as a list of name + number.

**Documents (A2, all optional):** permit copy, JSA, a copy of each certificate,
and any number of other documents (PDF, JPEG or PNG, up to 10 MB each). Files go
from the browser straight to **Cloudinary** (private; the server signs each upload
and makes a 5-minute link each time a file is opened). More can be added later from the permit page.
If a file fails, the permit is still saved and the message says which file to add again.

## Set-up (once)

1. **Supabase:** SQL Editor -> paste all of `supabase/01-permits.sql` -> Run
   (creates `permits` and `permit_options` with the starting lists). Then paste
   all of `supabase/02-certificates-and-files.sql` -> Run (certificates with
   numbers, and the `permit_files` table).
2. **GitHub:** create an empty repository and upload every file of this folder
   (keep the folder structure; do not upload `node_modules`).
3. **Vercel:** Add New -> Project -> pick the repository. Before deploying, add
   two Environment Variables (Supabase -> Project Settings -> API):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy, then open the site.

   Files also need the three Cloudinary values (Cloudinary dashboard ->
   Settings -> API Keys). They are secret, server only (no `NEXT_PUBLIC_`):
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

No service-role key is needed in this step.

## Test list

1. `/` loads and shows "0 permits stored so far".
2. `/permits/new`: the Area, Type, Applicant, Holder, Issuer and Controller
   dropdowns have names; Certificates shows tick boxes.
3. Press **Save permit** with the form empty: red messages under every
   required field, nothing saved.
4. Fill it in and save: a green "saved" message appears and the form clears.
5. `/permits` shows the permit with the status OPEN.
6. Enter the same permit number again (any capitals): refused as already used.
7. Set Valid to before Valid from: refused.
8. Pick type COLD and a Valid from date: "Latest allowed" appears in green
   (14 days later) with "Use it"; clicking inside either date box opens the calendar.
9. Try a Valid to later than that date: later days are greyed out in the calendar;
   typing one gives a red "Too long" message and the permit is not saved. Try
   HOT (7 days) and COLD BLANKET (30 days) too.
10. Tick two certificates: a number box appears for each, and saving with a box
    empty is refused. Tick NA: the other ticks clear and no number is asked.
11. Add a permit copy, a JSA, a certificate copy and one "other" document, then
    save. Open the permit from the list: the files open from their links.
12. On the permit page, add one more document with "Add file".
13. Try a file that is not PDF/JPEG/PNG, or over 10 MB: refused with a message.

## Step B: login and roles

Everything on the site now needs a sign-in (only `/login` is open). The Staff ID
becomes a made-up address `<id>@staff.permit-log.internal` for Supabase Auth, so
the accounts already in Authentication -> Users keep working with their old
passwords. No email is ever sent.

| Role | Can do |
|---|---|
| Root | View everything, add permits and files, **Admin area (B2)** |
| HSE | View everything, add permits and files |
| Manager | View only |
| Permit user | View only |

Account status: `pending` (cannot sign in yet), `active`, `disabled`. Every
account starts `pending`; it is approved by Root in Admin -> Users (step B2). The rules are enforced three times: in `middleware.js`
(URL), on the pages and API routes, and inside the database (`supabase/03-login-and-roles.sql`).
Roles are defined in one file: `lib/permissions.js`.

**Set-up for step B**

1. SQL Editor -> run all of `supabase/03-login-and-roles.sql`. It creates
   `profiles`, a profile (status pending) for every existing login, and replaces
   the temporary open rules with role rules.
2. Then, **in a separate run**, make yourself Root (use your own Staff ID, the part
   before the @ in Authentication -> Users):
   `update public.profiles set role = 'root', status = 'active' where staff_id = 'YOUR_ID';`
   Others: see the last section of the SQL file.
3. Supabase -> Authentication -> Sign In / Providers: switch **off** "Allow new
   users to sign up" (accounts are made by Root only). Even if it were on, a new
   account starts `pending` and cannot see anything.
4. Upload the files to GitHub (`package.json` now includes `@supabase/ssr`) and
   let Vercel redeploy. No new environment variables.

**Step B tests**

1. Open the site address while signed out: you land on `/login`.
2. A wrong password shows "Wrong Staff ID or password." (same message for a wrong ID).
3. Sign in as Root: the header shows your name, a Root tag, "+ New permit" and "Sign out".
4. Sign in as an ordinary user (activate one with SQL): no "+ New permit" button,
   no "Add a document" box, and `/permits/new` sends you back to the list.
5. A `pending` account tells you it is waiting for approval; a `disabled` one says so.
6. My profile: save a name (shows in the header), change the password, sign out and in with the new one.
7. Signed out, open a file link or `/api/permits`: refused (sign-in page or 401).

## Step B2: users admin

| Page | Who | What |
|---|---|---|
| `/register` | anyone | Request an account (Staff ID, name, password). Starts `pending` |
| `/forgot-password` | anyone | Ask Root for a temporary password (no email on this site) |
| `/change-password` | signed in | Forced after a temporary password; nothing else opens until it is changed |
| `/admin` | Root | Overview of what is waiting |
| `/admin/users` | Root | Approve / reject requests, change role, disable / enable, reset password, delete |
| `/admin/password-requests` | Root | Set a temporary password (shown once) or dismiss |
| `/admin/id-changes` | Root | Approve / reject Staff ID changes |
| `/profile` | everyone | New card: ask to change your Staff ID, or cancel the request |

Safety rules: nobody can change, disable or delete their own account from Admin; the
last active Root can never be demoted, disabled or deleted (checked in the code and
again by a database trigger). Public forms have a hidden trap field, a limit per IP
(5 per hour), a daily limit, and at most 40 waiting requests. The forgot-password form
always gives the same answer, so it cannot be used to find out which Staff IDs exist.
Staff ID change: one open request per person, 3 per day, the new ID must be free.

**Set-up for step B2 (in this order)**

1. Supabase -> SQL Editor: run all of `supabase/04-users-admin.sql`. **Before** deploying the code:
   the new middleware reads a column that this file creates.
2. Vercel -> Settings -> Environment Variables: add `SUPABASE_SERVICE_ROLE_KEY`
   (Supabase -> Project Settings -> API -> service_role). Secret, server only, no
   `NEXT_PUBLIC_`. Do not paste it anywhere else.
3. Upload the changed files to GitHub, let Vercel redeploy (no new packages).

**Step B2 tests**

1. Signed out, `/login` shows "Request an account" and "Forgot password?".
2. `/register`: send a request with a new Staff ID. Same ID again: "already has an account".
   A password under 8 characters, or two different passwords: refused.
3. Try to sign in as that new person: "waiting for approval".
4. As Root: header shows **Admin**. `/admin/users` lists the request first, with a count on the tab.
5. Approve it (choose a role first). The person can now sign in.
6. Change that person's role in the list. Sign in as them: the buttons match the role.
7. Disable them: their next click signs them out and sign-in says disabled. Enable: works again.
8. As HSE, Manager and Permit user: no Admin link; typing `/admin` goes back to the home page.
9. Root's own row has no Disable, Delete or role choice. With only one Root, there is no way to remove it.
10. `/forgot-password` with that person's Staff ID -> Root sees it in Password requests ->
    "Set temporary password" shows a code once -> the person signs in with it and is
    sent to `/change-password`, can open nothing else, sets a new password and then
    gets in. The old temporary password no longer works.
11. Same on the Users page: "Reset password" on a row.
12. `/forgot-password` with a Staff ID that does not exist: the same friendly answer,
    and nothing appears for Root.
13. My profile -> Staff ID: ask for a new ID. Asking again: refused (one open).
    Root approves: the person signs in with the new ID and the same password; the old ID no longer works.
    Also test Reject, Cancel, and asking for an ID that is already taken.
14. Reject a pending request: the account is removed and the ID can be requested again.

## Step C: edit, close, cancel, delete, dropdown lists

Root and HSE only (the server and the database both check). Everyone else sees none of these buttons.

| Where | What |
|---|---|
| Permit page -> **Edit permit** (`/permits/edit/<id>`) | Change any field. The permit number is locked. The 30/14/7-day limit still applies. Has a Status section (Open / Closed / Canceled; a cancel needs a reason) |
| Permit page -> **Actions** | **Close permit** (saves today's date, Oman time, as the closed date), **Cancel permit** (asks for a reason), **Reopen** (clears the closed date / reason), **Delete permit** (moves it to the trash, step C2) |
| Permit page -> each document -> **Delete** | Deletes that one file (record and the file in Cloudinary) |
| **Dropdown lists** (`/lists`, header link) | Add a value to any list (saved in UPPER CASE) or hide / show one. Values are never deleted: a hidden value still shows on the permits that use it |

How the rules work:
- **Closed date:** saved automatically when a permit becomes Closed and kept while it stays closed. Reopening or cancelling clears it.
- **Delete permit:** moves it to the trash (see step C2 below). Nothing is erased.
- **Delete one document:** permanent and immediate (record and Cloudinary file).
- **Certificate copies:** if you untick a certificate when editing, its uploaded copy moves to the Documents list (so it can still be opened or deleted).
- **Overdue / Expiring soon** are not chosen here; they come with step D.

**Set-up for step C (in this order)**

1. Supabase -> SQL Editor: run all of `supabase/05-edit-delete-lists.sql` (it adds edit, delete and dropdown rules for Root and HSE). Needs 01 to 04 already run.
2. Upload the files to GitHub and let Vercel redeploy. No new packages or environment variables.

**Step C tests** (use test permits, not real ones)

1. As HSE or Root: a permit page shows **Edit permit**, an **Actions** box and **Delete** next to each document. As Manager or Permit user: none of these, and `/permits/edit/<id>`, `/lists` go back to the list or home.
2. Edit a permit: change the location and holder, save. The permit page shows the new values. The permit number box is greyed out.
3. Edit: make Valid to later than the limit for its type: refused with "Too long".
4. Edit: untick a certificate that has an uploaded copy, save: the copy appears under Documents.
5. Close an open permit: status Closed and "Closed on" is today's date. Close it again via Edit (status stays Closed): the date does not change.
6. Reopen it: the closed date disappears. Cancel it: the reason is required and is shown on the page.
7. Edit with status Canceled but no reason: refused.
8. Delete one document: it disappears from the page, and the file is gone from Cloudinary (Media Library).
9. Delete a whole test permit that has 2 or 3 documents: the confirm box only enables when you type the number exactly (any capitals). Afterwards: the list shows "was deleted", the permit link says not found, and the files are gone from Cloudinary.
10. `/lists`: add a new Applicant, then open **+ New permit**: it is in the dropdown. Hide it: gone from the new form. A permit that already uses a hidden value still shows it when edited. Adding a value that exists (any capitals): refused.
11. Try the same calls as Manager/Permit user (for example from the browser address bar to `/lists`): refused.

## Step C2: recycle bin

| Who | Delete permit | Trash page | Restore | Delete for good |
|---|---|---|---|---|
| Root | to the trash | sees it | yes | **yes** (one, or empty the trash) |
| HSE | to the trash | sees it (read) | yes | no |
| Manager, Permit user | no | no | no | no |

- A trashed permit disappears from the permit list and the count, and cannot be edited, closed or given new documents until it is restored. Its documents stay in Cloudinary.
- Root and HSE can open a trashed permit from the Trash page (read-only, with a banner). Manager and Permit user cannot see it at all; the database hides it from them, not only the pages.
- A trashed permit **keeps its permit number reserved**: the number cannot be used again until the permit is restored or deleted for good. The form says "it may be in the trash".
- Deleting for good removes the permit, its document records and its Cloudinary files. Only Root can; the database refuses everyone else. Nothing is emptied automatically.
- Deleting ONE document is still permanent at once (not trashed).

**Set-up for step C2 (in this order)**

1. Supabase -> SQL Editor: run all of `supabase/06-trash.sql` (needs 01 to 05). Run it **before** deploying the code: the code reads the new `deleted_at` column.
2. Upload the files to GitHub and let Vercel redeploy. Nothing else to set.

**Step C2 tests** (test permits only; have at least one with 2 documents)

1. As HSE: on a test permit press **Delete permit (to trash)**: you land on the list with a green message, the permit is gone from the list, and the home page count drops by one.
2. HSE: the header has **Trash**. The permit is there with its document count and "deleted by". There is a **Restore** button but **no** "Delete for good" and no "Empty the trash".
3. HSE: open the trashed permit from Trash. The red banner shows; there is no Edit, Actions, Add a document or document Delete. Its documents still open.
4. Restore it: it is back in the list with the same status and documents.
5. As Manager and as Permit user: no Trash link; `/trash` sends you home; a link to the trashed permit says "Permit not found".
6. Trash a permit again, then as Root: **Delete for good** on it (confirm). The row goes and its files are gone in Cloudinary.
7. Trash two permits, as Root press **Empty the trash**, type EMPTY. Both go; type something else: nothing happens.
8. Create a new permit with the number of a trashed one: refused ("it may be in the trash"). After deleting it for good, the number can be used.
9. As HSE, try to reach `/api/trash/purge` (for example by sending the request from the browser console): refused (403).
10. While a permit is in the trash, try to open `/permits/edit/<id>`: it sends you to the permit page.

## Step D: status logic and dashboard

**Statuses.** The database stores only Open, Closed or Canceled. The site works out the rest every time a page loads, using today's date in **Oman time** (`Asia/Muscat`; the server itself runs in UTC, so this is calculated explicitly, in `lib/status.js` and `lib/omanDate.js`):

| Shown | When |
|---|---|
| **Overdue** | stored Open and Valid to is **before today** (shows "N days overdue") |
| **Expiring soon** | stored Open and **0 to 3 days** left until Valid to ("Ends today", "2 days left") |
| **Open** | stored Open, more than 3 days left |
| Closed / Canceled | shown as stored, whatever the dates are |

An open permit with no readable Valid to is shown as Open with a warning. "Active / Open" on the dashboard counts Open + Expiring soon + Overdue. Permits in the trash are never counted. The old Excel word EXPIRED is not used.

**Dashboard (`/`, everyone who can sign in):** alert banner when permits are overdue; cards (Total, Active / Open, Expiring soon, Overdue with the oldest days, Closed, Canceled) that open the matching list; status ring; "Ending in the next 14 days" bars (today's bar is amber); Needs attention (overdue and expiring lists, worst first); active permits by Area, Type, Applicant and Holder (top 8, click to filter). Header shows "Data as of" the Oman date.

**Permit list:** now shows the computed status with "N days left / overdue", plus search (number, location, applicant, holder) and filters for Status, Area and Type, "Showing x of y". The dashboard links use the address, for example `/permits?status=overdue`, `?status=expiring`, `?status=active`, `?area=CCS`, `?type=HOT`, `?holder=NAME`. The permit page shows the same status badge.

Not in D (later): My permits, People board and Copy summary (they need the name links), export (E), import (F).

**Set-up for step D:** no SQL, no new packages, no new environment variables. Upload the files and let Vercel redeploy.

**Step D tests** (make small test permits; edit Valid to to try each case)

1. Dashboard opens for every role (also Manager and Permit user) and says "Data as of" today's Oman date.
2. A test permit with Valid to **yesterday** shows **Overdue, "1 day overdue"** in the list and on its page, the red banner appears on the dashboard, and the Overdue card counts it.
3. Valid to **today**: Expiring soon, "Ends today". Valid to in 3 days: Expiring soon, "3 days left". In 4 days: Open, "4 days left". (Allowed lengths: COLD BLANKET 30 days, COLD 14, HOT 7 from Valid from, so use an earlier Valid from for old dates.)
4. Close an overdue permit: it leaves Overdue and counts under Closed. Cancel one: same under Canceled. Reopen: it is Overdue again.
5. Move a permit to the trash: it disappears from every count, the ring and the lists.
6. Click each card, a ring legend item and a bar: you land on `/permits` with the right filter, and "Showing x of y" is correct. **Clear** resets it.
7. Search by part of a permit number, location and holder. Combine status + area.
8. Between 00:00 and 04:00 Oman time the UTC date is still yesterday. If you can, look at the dashboard then: "Data as of" must show the **Oman** date, and a permit ending "today" (Oman) must be Expiring soon, not Open.
9. With zero permits: the dashboard shows zeros and an empty grey ring, no error.
10. The 14-day bars: a permit ending in 5 days adds one to the bar 5 places after today; an overdue permit is not in the bars.

## Not in this step (planned)

photo compression and crop for uploads · export to Excel · import of the 48 current permits · name links, My permits and People board.
