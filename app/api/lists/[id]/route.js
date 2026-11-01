import { getSupabase } from "../../../../lib/db";
import { getViewerStrict as getViewer } from "../../../../lib/viewer";
import { oneLine } from "../../../../lib/permitRules";
import { locKey } from "../../../../lib/locationMatch";

// Hides or shows one dropdown value. Never deletes: old permits keep their values.
// Body: { active: true | false }
export async function PATCH(request, { params }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Unknown value." }, { status: 400 });
  const body = await request.json().catch(() => null);

  // Rename (Location list, Root only): { value: "MPS - 1" }
  if (typeof body?.value === "string") return renameLocation(id, body.value);

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

async function rootOnly() {
  const viewer = await getViewer();
  return viewer?.role === "root";
}

// Renames a location. Permits keep the text they were saved with, so only the list changes;
// an old permit then shows its old text as "saved before" when edited.
async function renameLocation(id, raw) {
  const supabase = getSupabase();
  const { data: option } = await supabase.from("permit_options").select("id, list").eq("id", id).maybeSingle();
  if (!option) return Response.json({ error: "Not found, or not allowed." }, { status: 404 });
  if (option.list !== "location") return Response.json({ error: "Only locations can be renamed." }, { status: 400 });
  if (!(await rootOnly())) return Response.json({ error: "Only Root can change the Location list." }, { status: 403 });

  const value = oneLine(raw, 80).toUpperCase();
  if (!value) return Response.json({ error: "Type the new name." }, { status: 400 });

  // Same rule as adding: no two spellings of the same place.
  const { data: all, error: readError } = await supabase.from("permit_options").select("id, value").eq("list", "location").limit(5000);
  if (readError) return Response.json({ error: "Could not check the list. Please try again." }, { status: 500 });
  const clash = (all || []).find((o) => o.id !== id && locKey(o.value) === locKey(value));
  if (clash) return Response.json({ error: `${clash.value} already exists in this list. Same place, different spelling.` }, { status: 409 });

  const { data, error } = await supabase.from("permit_options").update({ value }).eq("id", id).select("id");
  if (error) {
    if (error.code === "23505") return Response.json({ error: `${value} is already in this list.` }, { status: 409 });
    console.error("Renaming a location failed:", error);
    return Response.json({ error: "Could not save. Please try again." }, { status: 500 });
  }
  if (!data || data.length === 0) return Response.json({ error: "Not found, or not allowed." }, { status: 404 });
  return Response.json({ ok: true, value });
}

// Deletes a location from the list (Root only; supabase/09-location-delete.sql).
// Other lists are never deleted from, only hidden.
export async function DELETE(request, { params }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Unknown value." }, { status: 400 });
  const supabase = getSupabase();
  const { data: option } = await supabase.from("permit_options").select("id, list").eq("id", id).maybeSingle();
  if (!option) return Response.json({ error: "Not found, or not allowed." }, { status: 404 });
  if (option.list !== "location") return Response.json({ error: "Only locations can be deleted. Other values can be hidden." }, { status: 400 });
  if (!(await rootOnly())) return Response.json({ error: "Only Root can change the Location list." }, { status: 403 });

  const { data, error } = await supabase.from("permit_options").delete().eq("id", id).select("id");
  if (error) {
    console.error("Deleting a location failed:", error);
    return Response.json({ error: "Could not delete it. Has supabase/09-location-delete.sql been run?" }, { status: 500 });
  }
  if (!data || data.length === 0) return Response.json({ error: "Not deleted. Has supabase/09-location-delete.sql been run?" }, { status: 403 });
  return Response.json({ ok: true });
}
