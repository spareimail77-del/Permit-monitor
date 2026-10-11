import { getSupabase } from "../../../../../lib/db";
import { getViewUrl } from "../../../../../lib/storage";

// Opens one file: makes a 5-minute private link and sends the browser there.
export async function GET(request, { params }) {
  const id = Number(params.fileId);
  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ error: "Unknown file." }, { status: 400 });
  }

  const { data: file } = await getSupabase()
    .from("permit_files")
    .select("storage_path, content_type")
    .eq("id", id)
    .maybeSingle();
  if (!file) return Response.json({ error: "File not found." }, { status: 404 });

  try {
    const url = await getViewUrl(file.storage_path, { contentType: file.content_type });
    return Response.redirect(url, 302);
  } catch (err) {
    console.error("Opening a file failed:", err);
    return Response.json({ error: "Could not open this file." }, { status: 500 });
  }
}
