import { joinLocations, locKey } from "./locationMatch";

// Server side of the Location picker: the real check. The browser shows chips, but
// whatever the browser sends is verified here against the Location list in the database.

const MAX_PICKED = 6;
const MAX_LENGTH = 200; // same limit as the location column on the form

// Every location in the list: [{ value, active }]. null if it could not be read.
export async function readLocationList(supabase) {
  const { data, error } = await supabase.from("permit_options").select("value, active").eq("list", "location").limit(5000);
  if (error) {
    console.error("Reading the location list failed:", error);
    return null;
  }
  return data || [];
}

// Decides the location text to store.
//  - The browser must send `locations` (an array of picked names). Each one must be an
//    active location in the list; the stored text is built HERE from them (A & B, A, B & C).
//  - One exception: when editing, leaving the old location text exactly as it was is allowed
//    (old permits keep whatever was typed back then).
// Returns { location } or { error }.
export async function resolveLocation(supabase, body, typedLocation, existingLocation = null) {
  const list = await readLocationList(supabase);
  if (list === null) return { error: "The location list could not be checked. Please try again." };
  const active = list.filter((o) => o.active);

  const picked = Array.isArray(body?.locations) ? body.locations : null;
  if (picked && picked.length > 0) {
    if (picked.length > MAX_PICKED) return { error: `Pick at most ${MAX_PICKED} locations.` };
    const byValue = new Map(active.map((o) => [String(o.value).trim().toUpperCase(), String(o.value).trim()]));
    const out = [];
    for (const raw of picked) {
      const hit = byValue.get(String(raw ?? "").trim().toUpperCase());
      if (!hit) return { error: `"${String(raw ?? "").slice(0, 40)}" is not in the Location list. Pick it from the chips.` };
      if (!out.some((x) => locKey(x) === locKey(hit))) out.push(hit);
    }
    const text = joinLocations(out);
    if (text.length > MAX_LENGTH) return { error: "These locations are too long to save together. Pick fewer." };
    return { location: text };
  }

  if (existingLocation !== null && String(typedLocation).trim() === String(existingLocation).trim()) {
    return { location: typedLocation };
  }
  if (active.length === 0) return { error: "No locations have been set up yet. Ask Root to add them (Lists page, or the Add chip on this form)." };
  return { error: "Pick the location from the list (type, then click a chip)." };
}
