import { put } from "@vercel/blob";
import { PERMIT_FILE_PATHNAME } from "../../../lib/blob";

// This route ONLY writes the raw Excel file to blob storage.
// It never reads, edits, or modifies the workbook's content —
// it's a byte-for-byte copy of whatever file you upload.
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ error: "No file received." }, { status: 400 });
    }

    const name = file.name || "";
    const okExtension = name.endsWith(".xlsm") || name.endsWith(".xlsx");
    if (!okExtension) {
      return Response.json(
        { error: "Please upload a .xlsm or .xlsx file." },
        { status: 400 }
      );
    }

    const blob = await put(PERMIT_FILE_PATHNAME, file, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType:
        "application/vnd.ms-excel.sheet.macroEnabled.12",
    });

    return Response.json({
      ok: true,
      originalName: name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      url: blob.url,
    });
  } catch (err) {
    console.error("Upload failed:", err);
    return Response.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }
}
