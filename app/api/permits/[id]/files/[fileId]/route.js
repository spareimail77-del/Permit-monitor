import { getSupabase } from "../../../../../../lib/db";
import { deleteObject } from "../../../../../../lib/storage";

// Deletes ONE attachment: its record and its file in Cloudinary. Root and HSE only
// (middleware: /api/permits needs manage_permits; the database policy checks again).
export async function DELETE(request, { params }) {
  const permitId = Number(params.id);
  const fileId = Number(params.fileId);
  if (!Number.isInteger(permitId) || permitId < 1 || !Number.isInteger(fileId) || fileId < 1) {
    return Response.json({ error: "Unknown file." }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: file } = await supabase
    .from("permit_files")
    .select("id, storage_path, content_type")
    .eq("id", fileId)
    .eq("permit_id", permitId) // the file must belong to this permit
    .maybeSingle();
  if (!file) return Response.json({ error: "File not found." }, { status: 404 });

  // A permit in the trash is read-only: restore it first.
  const { data: live } = await supabase.from("permits").select("id").eq("id", permitId).is("deleted_at", null).maybeSingle();
  if (!live) return Response.json({ error: "This permit is in the trash. Restore it first." }, { status: 409 });

  const { data: removed, error } = await supabase.from("permit_files").delete().eq("id", fileId).select("id");
  if (error) {
    console.error("Deleting a file record failed:", error);
    return Response.json({ error: "The file could not be deleted. Please try again." }, { status: 500 });
  }
  if (!removed || removed.length === 0) {
    return Response.json({ error: "You are not allowed to delete this file." }, { status: 403 });
  }

  try {
    await deleteObject(file.storage_path, { contentType: file.content_type });
  } catch (err) {
    console.error("Record deleted but the Cloudinary file remains:", file.storage_path, err);
    return Response.json({ ok: true, warning: "The file was removed from the permit, but could not be erased from storage." });
  }
  return Response.json({ ok: true });
}
