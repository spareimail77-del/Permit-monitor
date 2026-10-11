import { getSupabase } from "../../../lib/db";
import { OPTION_LISTS, oneLine } from "../../../lib/permitRules";

// Adds a value to a dropdown list. Root and HSE (middleware: /api/lists needs
// manage_options). Values are stored in UPPER CASE.
export async function POST(request) {
  const body = await request.json().catch(() => null);
  const list = String(body?.list ?? "");
  if (!OPTION_LISTS.some((l) => l.key === list)) return Response.json({ error: "Unknown list." }, { status: 400 });

  const value = oneLine(body?.value, 80).toUpperCase();
  if (!value) return Response.json({ error: "Type a value." }, { status: 400 });

  const { error } = await getSupabase().from("permit_options").insert({ list, value, sort: 100 });
  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: `${value} is already in this list (it may be hidden: show it instead).` }, { status: 409 });
    }
    console.error("Adding a list value failed:", error);
    return Response.json({ error: "Could not add it. Please try again." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
