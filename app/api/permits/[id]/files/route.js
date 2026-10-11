import { getSupabase } from "../../../../../lib/db";
import { deleteObject } from "../../../../../lib/storage";
import { ALLOWED_FILE_TYPES, FILE_KINDS, MAX_FILE_BYTES } from "../../../../../lib/fileRules";
import { oneLine } from "../../../../../lib/permitRules";

// Records files that the browser has already sent to Cloudinary. Checks each one
// again (kind, type, size, and that the path belongs to this permit).
export async function POST(request, { params }) {
  const permitId = Number(params.id);
  if (!Number.isInteger(permitId) || permitId < 1) {
    return Response.json({ error: "Unknown permit." }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Could not read the request." }, { status: 400 });
  }

  const list = Array.isArray(body?.files) ? body.files : [];
  if (list.length === 0 || list.length > 30) {
    return Response.json({ error: "Send between 1 and 30 files." }, { status: 400 });
  }

  const rows = [];
  for (const f of list) {
    const kind = String(f?.kind || "");
    const label = oneLine(f?.label, 80);
    const fileName = oneLine(f?.fileName, 200);
    const storagePath = String(f?.storagePath || "");
    const contentType = String(f?.contentType || "");
    const sizeBytes = Number(f?.sizeBytes);

    if (!FILE_KINDS[kind]) return Response.json({ error: "Unknown kind of document." }, { status: 400 });
    if (kind === "certificate" && !label) {
      return Response.json({ error: "A certificate copy needs the certificate name." }, { status: 400 });
    }
    if (!fileName) return Response.json({ error: "A file has no name." }, { status: 400 });
    if (!storagePath.startsWith(`permits/${permitId}/`) || storagePath.includes("..")) {
      return Response.json({ error: "A file does not belong to this permit." }, { status: 400 });
    }
    if (!ALLOWED_FILE_TYPES[contentType]) {
      return Response.json({ error: `${fileName}: only PDF, JPEG or PNG files are allowed.` }, { status: 400 });
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_FILE_BYTES) {
      return Response.json({ error: `${fileName}: the file is empty or larger than 10 MB.` }, { status: 400 });
    }
    rows.push({
      permit_id: permitId,
      kind,
      label,
      file_name: fileName,
      storage_path: storagePath,
      content_type: contentType,
      size_bytes: Math.round(sizeBytes),
    });
  }

  const supabase = getSupabase();
  const { data: permit, error: readError } = await supabase
    .from("permits")
    .select("id")
    .eq("id", permitId)
    .maybeSingle();
  if (readError || !permit) {
    return Response.json({ error: "This permit does not exist." }, { status: 404 });
  }

  const { error } = await supabase.from("permit_files").insert(rows);
  if (error) {
    console.error("Recording files failed:", error);
    // Do not leave the files behind in storage.
    await Promise.allSettled(rows.map((r) => deleteObject(r.storage_path, { contentType: r.content_type })));
    return Response.json({ error: "The files could not be recorded. Please try again." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
