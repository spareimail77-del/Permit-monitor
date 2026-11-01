import { getSupabase } from "../../../../lib/db";
import { getViewerStrict as getViewer } from "../../../../lib/viewer";

// Hides or shows one dropdown value. Never deletes: old permits keep their values.
// Body: { active: true | false }
export async function PATCH(request, { params }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Unknown value." }, { status: 400 });
  const body = await request.json().catch(() => null);
  if (typeof body?.active !== "boolean") return Response.json({ error: "Say whether to show or hide it." }, { status: 400 });

  const supabase = getSupabase();

  // The Location list can only be changed by Root.
  const { data: option } = await supabase.from("permit_options").select("list").eq("id", id).maybeSingle();
  if (option?.list === "location") {
    const viewer = await getViewer();
    if (viewer?.role !== "root") return Response.json({ error: "Only Root can change the Location list." }, { status: 403 });
  }

  const { data, error } = await supabase.from("permit_options").update({ active: body.active }).eq("id", id).select("id");
  if (error) {
    console.error("Changing a list value failed:", error);
    return Response.json({ error: "Could not save. Please try again." }, { status: 500 });
  }
  if (!data || data.length === 0) return Response.json({ error: "Not found, or not allowed." }, { status: 404 });
  return Response.json({ ok: true });
}
