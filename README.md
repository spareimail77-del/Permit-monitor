# HSE Permits — step A / A2

The smallest working piece of the new site: a **permit form** that saves into
the database, and a plain **permit list** to see what was stored. No login yet
(step B). Rebuild plan and system reference: see "SWWS Permit Log Register — System Reference".

## What is in this step

| Page | What it does |
|---|---|
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

## Temporary: open access

Until step B (login) anyone with the site address can read and add permits and
files. Do
not share the address and do not enter real data yet.

## Not in this step (planned)

Login and roles (B) · edit / close / cancel · dropdown-list admin · status logic
and dashboard · photo compression and crop for uploads · export · import of the
48 current permits.
