# HSE Permits — step A skeleton

The smallest working piece of the new site: a **permit form** that saves into
the database, and a plain **permit list** to see what was stored. No login yet
(step B). Rebuild plan and system reference: see "SWWS Permit Log Register — System Reference".

## What is in this step

| Page | What it does |
|---|---|
| `/` | Home, with the number of permits stored |
| `/permits/new` | The permit form (dropdowns from the database) |
| `/permits` | List of everything stored, newest first |
| `POST /api/permits` | Checks and saves one permit |

Form rules: required = permit number, Area, Location, Type, Job description,
Applicant, Controller, Valid from, Valid to. Valid to cannot be before Valid
from. A permit number can be used once. A new permit always starts OPEN. The
end date is only *suggested* (Blanket 30 days, COLD 14, HOT 7).

## Set-up (once)

1. **Supabase:** create a new project. SQL Editor -> paste all of
   `supabase/01-permits.sql` -> Run. (Table Editor should now show `permits`
   and `permit_options`, the second with the starting lists.)
2. **GitHub:** create an empty repository and upload every file of this folder
   (keep the folder structure; do not upload `node_modules`).
3. **Vercel:** Add New -> Project -> pick the repository. Before deploying, add
   two Environment Variables (Supabase -> Project Settings -> API):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy, then open the site.

No service-role key and no other secret is needed in this step.

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
8. Pick type COLD BLANKET and a Valid from date: a suggested end date appears
   with "Use it".

## Temporary: open access

Until step B (login) anyone with the site address can read and add permits. Do
not share the address and do not enter real data yet.

## Not in this step (planned)

Login and roles (B) · edit / close / cancel · dropdown-list admin · status logic
and dashboard · attachments · export · import of the 48 current permits.
