import { getSupabase } from "../../../lib/db";
import { getViewerStrict as getViewer } from "../../../lib/viewer";
import { OPTION_LISTS, oneLine } from "../../../lib/permitRules";
import { locKey } from "../../../lib/locationMatch";

// Adds a value to a dropdown list. Root and HSE (middleware: /api/lists needs
// manage_options), except the Location list, which only Root may change.
// Values are stored in UPPER CASE.
export async function POST(request) {
  const body = await request.json().catch(() => null);
  const list = String(body?.list ?? "");
  if (!OPTION_LISTS.some((l) => l.key === list)) return Response.json({ error: "Unknown list." }, { status: 400 });

  const value = oneLine(body?.value, 80).toUpperCase();
  if (!value) return Response.json({ error: "Type a value." }, { status: 400 });

  const supabase = getSupabase();

  if (list === "location") {
    const viewer = await getViewer();
    if (viewer?.role !== "root") return Response.json({ error: "Only Root can add locations. Ask Root to add it." }, { status: 403 });

    // "MPS1", "MPS 1" and "MPS - 01" are the same place: refuse spellings that only differ in
    // spaces, dashes, capitals or leading zeros, so the list itself stays clean.
    const { data: all, error: readError } = await supabase.from("permit_options").select("value, active").eq("list", "location").limit(5000);
    if (readError) return Response.json({ error: "Could not check the list. Please try again." }, { status: 500 });
    const clash = (all || []).find((o) => locKey(o.value) === locKey(value));
    if (clash) {
      return Response.json(
        { error: `${clash.value} already exists in this list${clash.active ? "" : " (hidden: show it instead)"}. Same place, different spelling.` },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase.from("permit_options").insert({ list, value, sort: 100 });
  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: `${value} is already in this list (it may be hidden: show it instead).` }, { status: 409 });
    }
    if (error.code === "42501") {
      return Response.json({ error: "You are not allowed to change this list." }, { status: 403 });
    }
    console.error("Adding a list value failed:", error);
    return Response.json({ error: "Could not add it. Please try again." }, { status: 500 });
  }
  return Response.json({ ok: true, value });
}
