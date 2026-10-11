import { getSupabase } from "../../../../lib/db";

// Hides or shows one dropdown value. Never deletes: old permits keep their values.
// Body: { active: true | false }
export async function PATCH(request, { params }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Unknown value." }, { status: 400 });
  const body = await request.json().catch(() => null);
  if (typeof body?.active !== "boolean") return Response.json({ error: "Say whether to show or hide it." }, { status: 400 });

  const { data, error } = await getSupabase().from("permit_options").update({ active: body.active }).eq("id", id).select("id");
  if (error) {
    console.error("Changing a list value failed:", error);
    return Response.json({ error: "Could not save. Please try again." }, { status: 500 });
  }
  if (!data || data.length === 0) return Response.json({ error: "Not found, or not allowed." }, { status: 404 });
  return Response.json({ ok: true });
}
