# Permit Log Register — Web Dashboard

Read-only work permit monitoring site for the SWWS Salalah permit log.
Excel remains the master record. This site never writes back to it.

## Step 1 of 8: project skeleton

This first version has no permit data yet — it's just a deployable
starting point so we can confirm Vercel hosting works before adding
any real functionality.

## How to deploy this (Step 1)

You don't need to install anything on your computer for this step if
you don't want to — GitHub + Vercel's website is enough.

1. **Create a free GitHub account** at github.com if you don't have one.
2. **Create a new repository** (e.g. `permit-monitor`), and upload all
   the files in this folder to it (GitHub's web "Add file → Upload
   files" works fine — drag the whole folder in).
3. **Create a free Vercel account** at vercel.com — sign up with your
   GitHub account, it's the easiest option.
4. In Vercel, click **Add New → Project**, and select the
   `permit-monitor` repository you just created.
5. Leave all settings as default (Vercel auto-detects Next.js) and
   click **Deploy**.
6. After a minute or two, Vercel gives you a live URL like
   `permit-monitor-yourname.vercel.app`. Open it — you should see a
   "Project skeleton deployed" page.

That confirms hosting works. Reply here once you've seen it live (or
if anything went wrong) and we'll move to Step 2: adding file upload
and storage.
