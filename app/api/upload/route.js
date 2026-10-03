import { put } from "@vercel/blob";
import { revalidateTag } from "next/cache";
import { PERMIT_FILE_PATHNAME } from "../../../lib/blob";
import { fetchPermitData, parsePermitsFromBuffer, PERMIT_DATA_TAG } from "../../../lib/parsePermits";
import { diffPermits } from "../../../lib/permitDiff";
import { syncArchive } from "../../../lib/archive";
import { createClient } from "../../../lib/supabase/server";
import { getAccess, hasPermission } from "../../../lib/authz";
import { logUpload } from "../../../lib/uploadLog";

// This route ONLY writes the raw Excel file to blob storage.
// It never reads, edits, or modifies the workbook's content —
// it's a byte-for-byte copy of whatever file you upload.
//
// Middleware already blocks users without permission from reaching this route, but
// this check runs independently so the lock still holds even if
// middleware config ever changes.
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
    const okExtension = name.endsWith(".xlsm") || name.endsWith(".xlsx");
    if (!okExtension) {
      await logUpload({
        userId: user.id,
        fileName: name,
        sizeBytes: file.size,
        status: "rejected",
        note: "Not an .xlsm or .xlsx file.",
      });
      return Response.json(
        { error: "Please upload a .xlsm or .xlsx file." },
        { status: 400 }
      );
    }

    // Copy new and changed permits into the archive (one row per permit
    // number, unchanged permits are not written, so this stays small).
    // Permits missing from the new file are only marked "no longer in the
    // log", never deleted. A failure here never blocks the upload; it is
    // reported back, and the next upload repairs it.
    let archivedCount = 0;
    let archiveSummary = null;
    let diff = null; // added / updated / removed compared with the file on the site now
    let archiveWarning = null;
    let permitCount = null;
    try {
      const newParsed = parsePermitsFromBuffer(await file.arrayBuffer());
      if (newParsed.isExport) {
        await logUpload({
          userId: user.id,
          fileName: name,
          sizeBytes: file.size,
          status: "rejected",
          note: "File was created by the Export button, not the master log.",
        });
        return Response.json(
          {
            error:
              "This file was created by the Export button, so it is not the master permit log. Upload your original Excel file instead.",
          },
          { status: 400 }
        );
      }
      if (newParsed.error || newParsed.permits.length === 0) {
        await logUpload({
          userId: user.id,
          fileName: name,
          sizeBytes: file.size,
          status: "rejected",
          note: newParsed.message || "No permits were found in the file.",
        });
        return Response.json(
          {
            error:
              newParsed.message ||
              "No permits were found in this file. Check that it is the permit log.",
          },
          { status: 400 }
        );
      }

      permitCount = newParsed.permits.length;

      // What this upload changes, for the upload log. Looks at the file that
      // is on the site right now; if there is none (first upload) or it can't
      // be read, the log simply has no change details for this upload.
      try {
        const old = await fetchPermitData();
        if (!old.error && Array.isArray(old.permits)) {
          diff = diffPermits(old.permits, newParsed.permits);
        }
      } catch (err) {
        console.error("Comparing with the previous file failed:", err);
      }

      archiveSummary = await syncArchive(supabase, user.id, newParsed.permits);
      archivedCount = archiveSummary.added + archiveSummary.refreshed;
    } catch (err) {
      console.error("Saving permits to the archive failed:", err);
      archiveWarning =
        "The archive could not be updated this time. The new file was still uploaded; the next upload will catch up.";
    }

    const blob = await put(PERMIT_FILE_PATHNAME, file, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType:
        "application/vnd.ms-excel.sheet.macroEnabled.12",
    });

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

    // Forget the cached "which file is current" answer so every page sees the
    // new upload straight away (the parsed data is keyed on the upload time,
    // so it can't go stale on its own).
    try {
      revalidateTag(PERMIT_DATA_TAG);
    } catch (err) {
      console.error("Could not clear the permit data cache:", err);
    }

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
