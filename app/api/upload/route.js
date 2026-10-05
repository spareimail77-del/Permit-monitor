import { put } from "@vercel/blob";
import { revalidateTag } from "next/cache";
import { PERMIT_FILE_PATHNAME } from "../../../lib/blob";
import { fetchPermitData, parsePermitsFromBuffer, PERMIT_DATA_TAG } from "../../../lib/parsePermits";
import { diffPermits } from "../../../lib/permitDiff";
import { syncArchive } from "../../../lib/archive";
import { createClient } from "../../../lib/supabase/server";
import { getAccess, hasPermission } from "../../../lib/authz";
import { logUpload } from "../../../lib/uploadLog";

// This route saves the raw Excel file to blob storage (byte-for-byte copy,
// the workbook is never edited) and then copies new/changed permits into the
// archive.
//
// Safe order (step 44):
//   1. check the file      (a bad file is refused, nothing changes)
//   2. compare with the file on the site now (for the upload log)
//   3. SAVE the new Excel  (this is what the Permit List and Dashboard read)
//   4. only then update the archive
//   5. write the upload log
// So the archive can never be updated while the live file is not.
//
// Middleware already blocks users without permission from reaching this route, but
// this check runs independently so the lock still holds even if
// middleware config ever changes.
// Archive writes go one request at a time to the database; give them room.
export const maxDuration = 60;

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      { error: "Not authenticated. Sign in at /login first." },
      { status: 401 }
    );
  }

  const access = await getAccess(supabase, user.id);

  if (!hasPermission(access, "upload_excel")) {
    return Response.json(
      { error: "Not authorized. You do not have permission to upload." },
      { status: 403 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ error: "No file received." }, { status: 400 });
    }

    const name = file.name || "";
    const lower = name.toLowerCase();
    const okExtension = lower.endsWith(".xlsm") || lower.endsWith(".xlsx");
    const reject = async (note, error) => {
      await logUpload({
        userId: user.id,
        fileName: name,
        sizeBytes: file.size,
        status: "rejected",
        note,
      });
      return Response.json({ error }, { status: 400 });
    };

    if (!okExtension) {
      return reject("Not an .xlsm or .xlsx file.", "Please upload a .xlsm or .xlsx file.");
    }

    // 1. Check the file. Nothing is saved anywhere if it is not a good log.
    const newParsed = parsePermitsFromBuffer(await file.arrayBuffer());
    if (newParsed.isExport) {
      return reject(
        "File was created by the Export button, not the master log.",
        "This file was created by the Export button, so it is not the master permit log. Upload your original Excel file instead."
      );
    }
    if (newParsed.error || newParsed.permits.length === 0) {
      const msg = newParsed.message || "No permits were found in the file.";
      return reject(
        msg,
        newParsed.message ||
          "No permits were found in this file. Check that it is the permit log."
      );
    }
    const permitCount = newParsed.permits.length;

    // 2. What this upload changes, compared with the file on the site now.
    // No file yet (first upload) or unreadable: the log just has no details.
    let diff = null;
    try {
      const old = await fetchPermitData();
      if (!old.error && Array.isArray(old.permits)) {
        diff = diffPermits(old.permits, newParsed.permits);
      }
    } catch (err) {
      console.error("Comparing with the previous file failed:", err);
    }

    // 3. Save the new Excel file. If this fails, nothing else has changed.
    let blob;
    try {
      blob = await put(PERMIT_FILE_PATHNAME, file, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/vnd.ms-excel.sheet.macroEnabled.12",
      });
    } catch (err) {
      console.error("Saving the Excel file to Blob failed:", err);
      await logUpload({
        userId: user.id,
        fileName: name,
        sizeBytes: file.size,
        permitCount,
        status: "rejected",
        note: `Could not save the file: ${String(err?.message || err).slice(0, 200)}`,
      });
      return Response.json(
        {
          error:
            "The file could not be saved to storage, so nothing was changed (the Permit List, Dashboard and Archive still show the previous upload). Please try again.",
        },
        { status: 500 }
      );
    }

    // Forget the cached "which file is current" answer right away so the
    // Permit List and Dashboard show the new file even if the archive step
    // below is slow.
    try {
      revalidateTag(PERMIT_DATA_TAG);
    } catch (err) {
      console.error("Could not clear the permit data cache:", err);
    }

    // 4. Now copy new / changed permits into the archive. A failure here never
    // undoes the upload; it is reported and the next upload repairs it.
    let archivedCount = 0;
    let archiveSummary = null;
    let archiveWarning = null;
    try {
      archiveSummary = await syncArchive(supabase, user.id, newParsed.permits);
      archivedCount = archiveSummary.added + archiveSummary.refreshed;
    } catch (err) {
      console.error("Saving permits to the archive failed:", err);
      archiveWarning =
        "The new file is saved and live, but the archive could not be updated this time. The next upload will catch up.";
    }

    // 5. Upload log.
    await logUpload({
      userId: user.id,
      fileName: name,
      sizeBytes: file.size,
      permitCount,
      archivedCount,
      addedCount: diff?.addedCount,
      updatedCount: diff?.updatedCount,
      removedCount: diff?.removedCount,
      changes: diff?.changes,
      status: "uploaded",
      note: archiveWarning,
    });

    return Response.json({
      ok: true,
      originalName: name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      url: blob.url,
      archivedCount,
      archiveSummary,
      diff,
      permitCount,
      archiveWarning,
    });
  } catch (err) {
    console.error("Upload failed:", err);
    return Response.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }
}
