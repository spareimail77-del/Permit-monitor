# HSE Permits — steps A, A2, A3, B, B2

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

## Not in this step (planned)

edit / close / cancel · dropdown-list admin · status logic
and dashboard · photo compression and crop for uploads · export · import of the
48 current permits.
