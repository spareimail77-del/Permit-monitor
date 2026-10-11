import { getSupabase } from "../../../../lib/db";
import { getViewer } from "../../../../lib/viewer";
import { can } from "../../../../lib/permissions";
import { deleteObject } from "../../../../lib/storage";

// Deletes permits from the trash FOR GOOD: the permit, its document records and
// its files in Cloudinary. ROOT ONLY (middleware: /api/trash/purge needs
// purge_trash; checked again here, and the database only lets Root delete).
// Body: { id } for one permit, or { all: true } to empty the trash.
// Only permits that are already in the trash can be purged.

async function inChunks(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.allSettled(items.slice(i, i + size).map(fn))));
  }
  return out;
}

export async function POST(request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Not authenticated." }, { status: 401 });
  if (!can(viewer.role, "purge_trash")) return Response.json({ error: "Only Root can delete from the trash." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const all = body?.all === true;
  const id = Number(body?.id);
  if (!all && (!Number.isInteger(id) || id < 1)) return Response.json({ error: "Unknown permit." }, { status: 400 });

  const supabase = getSupabase();
  let q = supabase.from("permits").select("id, reference").not("deleted_at", "is", null).limit(1000);
  if (!all) q = q.eq("id", id);
  const { data: permits, error: readError } = await q;
  if (readError) {
    console.error("Reading the trash failed:", readError);
    return Response.json({ error: "Could not read the trash." }, { status: 500 });
  }
  if (!permits || permits.length === 0) {
    return all
      ? Response.json({ ok: true, permitsDeleted: 0, filesDeleted: 0, filesNotRemoved: 0 })
      : Response.json({ error: "That permit is not in the trash." }, { status: 404 });
  }

  const ids = permits.map((p) => p.id);

  // File records first (the permit delete removes them), so we know what to erase.
  const files = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("permit_files")
      .select("permit_id, storage_path, content_type")
      .in("permit_id", ids)
      .range(from, from + 999);
    if (error) {
      console.error("Reading the files of trashed permits failed:", error);
      return Response.json({ error: "Could not read the documents. Nothing was deleted." }, { status: 500 });
    }
    files.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  // Database: the permits (their file records go by cascade).
  const { data: removed, error } = await supabase
    .from("permits")
    .delete()
    .in("id", ids)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) {
    console.error("Deleting from the trash failed:", error);
    return Response.json({ error: "Could not delete. Nothing was changed." }, { status: 500 });
  }
  const gone = new Set((removed || []).map((r) => r.id));
  if (gone.size === 0) return Response.json({ error: "You are not allowed to delete from the trash." }, { status: 403 });

  // Then the stored files of the permits that really are gone.
  const toErase = files.filter((f) => gone.has(f.permit_id));
  const results = await inChunks(toErase, 8, (f) => deleteObject(f.storage_path, { contentType: f.content_type }));
  const left = toErase.filter((_, i) => results[i].status === "rejected").map((f) => f.storage_path);
  if (left.length) console.error("Permits purged but these Cloudinary files remain:", left);

  return Response.json({
    ok: true,
    permitsDeleted: gone.size,
    filesDeleted: toErase.length - left.length,
    filesNotRemoved: left.length,
  });
}
