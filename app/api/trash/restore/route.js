import { getSupabase } from "../../../../lib/db";

// Puts a permit back from the trash. Root and HSE (middleware: /api/trash needs
// view_trash; the database update policy checks again). Body: { id }
export async function POST(request) {
  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Unknown permit." }, { status: 400 });

  const { data, error } = await getSupabase()
    .from("permits")
    .update({ deleted_at: null, deleted_by: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) {
    console.error("Restoring a permit failed:", error);
    return Response.json({ error: "Could not restore it. Please try again." }, { status: 500 });
  }
  if (!data || data.length === 0) return Response.json({ error: "That permit is not in the trash." }, { status: 404 });
  return Response.json({ ok: true });
}
