# Permit Log Register — Web Dashboard

Read-only work permit monitoring site for the SWWS Salalah permit log.
Excel remains the master record. This site never writes back to it.

## Step 1 of 8: project skeleton ✅

Confirmed working — the site deploys and hosting is set up.

## Step 2 of 8: Vercel Blob storage + upload page

This adds a page at `/upload` where you can upload your `.xlsm` file.
It gets stored in Vercel Blob storage. Nothing reads or displays
permit data yet — that's Step 3.

### 2a. Create the Blob store (one-time, in Vercel's website)

1. In your Vercel project, go to the **Storage** tab.
2. Click **Create Database** → choose **Blob**.
3. Give it any name (e.g. `permit-storage`) and create it.
4. Vercel will ask to **connect it to your project** — say yes. This
   automatically adds the required `BLOB_READ_WRITE_TOKEN` environment
   variable for you. You don't need to copy/paste any secret yourself.

### 2b. Deploy the updated code

1. Replace the files in your GitHub repository with the new files in
   this folder (same upload method as Step 1 — this adds
   `app/api/upload/route.js`, `app/upload/page.js`, and `lib/blob.js`,
   and adds one new dependency in `package.json`).
2. Vercel will automatically redeploy when it sees the update.

### 2c. Test it

1. Open `your-site.vercel.app/upload`.
2. Choose your `.xlsm` file and click **Upload**.
3. You should see a confirmation with the filename, size, and upload
   time.

This only copies the file into storage — it does not yet parse or
display any permit data. Reply once you've uploaded successfully (or
tell me what error you see) and we'll move to Step 3: reading the
Excel file.
