import { createClient } from "../../../../../lib/supabase/server";
import { deleteObject } from "../../../../../lib/storage";
import { getAccess, hasPermission } from "../../../../../lib/authz";

// Bulk, permanent delete of archived permits. For each permit this
// removes its attachment files (Cloudinary), its permit_attachments
// rows, and finally the archived_permits row itself. There is no
// undo — the confirmation happens client-side before this is called.
// Best-effort per permit: one failure doesn't stop the rest.

// Kept small so one request finishes well inside a serverless time
// limit; the archive page sends larger selections in several batches.
const MAX_PER_REQUEST = 50;
const CONCURRENCY = 5;

export const maxDuration = 60;

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const access = await getAccess(supabase, user.id);
  if (!hasPermission(access, "manage_archive")) {
    return Response.json(
      { error: "Not authorized. You do not have permission to delete archived permits." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.filter((id) => typeof id === "string" && id))]
    : [];

  if (ids.length === 0) {
    return Response.json({ error: "No permits selected." }, { status: 400 });
  }
  if (ids.length > MAX_PER_REQUEST) {
    return Response.json(
      { error: `Select ${MAX_PER_REQUEST} or fewer at a time.` },
      { status: 400 }
    );
  }

  const { data: permits, error: fetchError } = await supabase
    .from("archived_permits")
    .select("id, reference, in_log")
    .in("id", ids);

  if (fetchError) {
    return Response.json({ error: "Could not look up the selected permits." }, { status: 500 });
  }

  // A permit that is still in the uploaded Excel is never deleted here: its
  // attachments would be lost and the next upload would copy it back anyway.
  const all = permits || [];
  const found = all.filter((p) => !p.in_log);
  const kept = all.length - found.length;
  const foundIds = all.map((p) => p.id);
  const missing = ids.length - foundIds.length;

  const results = { deleted: 0, failed: [], missing, kept };

  async function removeOne(permit) {
    try {
      const { data: attachments } = await supabase
        .from("permit_attachments")
        .select("id, storage_key, content_type")
        .eq("permit_reference", permit.reference);

      for (const att of attachments || []) {
        try {
          await deleteObject(att.storage_key, { contentType: att.content_type });
        } catch (err) {
          // File already gone or Cloudinary hiccup — still clear the
          // row below rather than leaving an orphaned DB record and
          // blocking the permit delete over one stuck file.
          console.error(`Cloudinary delete failed for ${att.storage_key}:`, err);
        }
      }

      if ((attachments || []).length > 0) {
        const { error: attErr } = await supabase
          .from("permit_attachments")
          .delete()
          .eq("permit_reference", permit.reference);
        if (attErr) throw attErr;
      }

      const { error: permitErr } = await supabase
        .from("archived_permits")
        .delete()
        .eq("id", permit.id);
      if (permitErr) throw permitErr;

      results.deleted += 1;
    } catch (err) {
      console.error(`Archive delete failed for ${permit.reference}:`, err);
      results.failed.push(permit.reference);
    }
  }

  // A few permits at a time: much faster than one by one, without
  // hammering Cloudinary or the database.
  const queue = [...found];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length) await removeOne(queue.shift());
    })
  );

  return Response.json({ ok: true, ...results });
}
