import { getSupabase } from "../../../../lib/db";
import { getViewerStrict as getViewer } from "../../../../lib/viewer";
import { todayOman } from "../../../../lib/omanDate";
import { oneLine, statusPatch, validatePermitInput, validateStatusInput } from "../../../../lib/permitRules";
import { resolveLocation } from "../../../../lib/locationServer";

// Root and HSE only: middleware checks the URL (/api/permits needs
// manage_permits) and the database policies check again.

function parseId(params) {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}
const bad = (error, status = 400, extra = {}) => Response.json({ error, ...extra }, { status });

// PATCH body: { action: "edit", ...form fields, status, cancelReason }
//          or { action: "close", fill? } | { action: "cancel", reason } | { action: "reopen" }
// "close" may carry fill: { holder, issuer, areaAuthority } (from the check-before-closing
// popup): only fields that are still EMPTY are filled, Holder and Issuer must be names from
// the lists, and the permit is closed in the same single database step.

const FILL_FIELDS = [
  { key: "holder", column: "holder", label: "Permit holder", max: 80, list: "holder" },
  { key: "issuer", column: "issuer", label: "Authorized permit issuer", max: 80, list: "issuer" },
  { key: "areaAuthority", column: "area_authority", label: "Area authority", max: 120, list: null },
];

// -> { patch, guards } or { error }. guards: the empty value each filled column had when
// read, so the update only applies if nobody changed it in between.
async function readFill(supabase, fill, permit) {
  const out = { patch: {}, guards: {} };
  if (!fill || typeof fill !== "object") return out;
  for (const f of FILL_FIELDS) {
    const value = oneLine(fill[f.key], f.max);
    if (!value) continue;
    const current = permit[f.column] ?? "";
    if (String(current).trim() !== "") continue; // never overwrite what is already there
    let stored = value;
    if (f.list) {
      const { data, error } = await supabase.from("permit_options").select("value").eq("list", f.list).eq("active", true).limit(1000);
      if (error) return { error: "The list could not be checked. Please try again." };
      const hit = (data || []).find((o) => String(o.value).trim().toUpperCase() === value.toUpperCase());
      if (!hit) return { error: `${f.label} must be chosen from the list.` };
      stored = hit.value;
    }
    out.patch[f.column] = stored;
    out.guards[f.column] = current;
  }
  return out;
}
export async function PATCH(request, { params }) {
  const id = parseId(params);
  if (!id) return bad("Unknown permit.");
  const body = await request.json().catch(() => null);
  if (!body) return bad("Could not read the request.");

  const supabase = getSupabase();
  const { data: permit, error: readError } = await supabase
    .from("permits")
    .select("id, reference, status, closed_at, deleted_at, location, holder, issuer, area_authority")
    .eq("id", id)
    .maybeSingle();
  if (readError || !permit) return bad("This permit does not exist.", 404);
  if (permit.deleted_at) return bad("This permit is in the trash. Restore it first.", 409);

  const today = todayOman();
  let patch;
  let guards = {};

  if (body.action === "close") {
    if (permit.status !== "OPEN") return bad("Only an open permit can be closed.", 409);
    patch = statusPatch(permit, "CLOSED", "", today);
    const fill = await readFill(supabase, body.fill, permit);
    if (fill.error) return bad(fill.error, 400);
    patch = { ...patch, ...fill.patch };
    guards = fill.guards;
  } else if (body.action === "cancel") {
    if (permit.status !== "OPEN") return bad("Only an open permit can be canceled.", 409);
    const { errors, clean } = validateStatusInput("CANCELED", body.reason);
    if (errors.cancelReason) return bad(errors.cancelReason);
    patch = statusPatch(permit, "CANCELED", clean.cancelReason, today);
  } else if (body.action === "reopen") {
    if (permit.status === "OPEN") return bad("This permit is already open.", 409);
    patch = statusPatch(permit, "OPEN", "", today);
  } else if (body.action === "edit") {
    // The permit number is fixed once saved: whatever was sent is ignored.
    const { errors, clean } = validatePermitInput({ ...body, reference: permit.reference });
    const st = validateStatusInput(body.status, body.cancelReason);
    const all = { ...errors, ...st.errors };
    if (Object.keys(all).length > 0) {
      return bad("Please fix the marked fields.", 400, { fields: all });
    }
    // The location must come from the Location list, unless it is left exactly as it was.
    const loc = await resolveLocation(supabase, body, clean.location, permit.location || "");
    if (loc.error) return bad(loc.error, 400, { fields: { location: loc.error } });
    clean.location = loc.location;
    patch = {
      area: clean.area,
      location: clean.location,
      permit_type: clean.permitType,
      job_description: clean.jobDescription,
      certificates: clean.certificates,
      applicant: clean.applicant,
      holder: clean.holder,
      issuer: clean.issuer,
      area_authority: clean.areaAuthority,
      controller: clean.controller,
      valid_from: clean.validFrom,
      valid_to: clean.validTo,
      ...statusPatch(permit, st.clean.status, st.clean.cancelReason, today),
    };
  } else {
    return bad("Unknown action.");
  }

  // Editing the form: save only if nobody saved the permit since this person opened it.
  // The check is part of the UPDATE itself (one step), so two saves at the same moment
  // cannot both win. A client that sends no version (an old open page) is not checked.
  const expected =
    body.action === "edit" && typeof body.expectedUpdatedAt === "string" && body.expectedUpdatedAt && body.expectedUpdatedAt.length <= 64
      ? body.expectedUpdatedAt
      : "";

  const newVersion = new Date().toISOString();
  let query = supabase.from("permits").update({ ...patch, updated_at: newVersion }).eq("id", id);
  if (expected) query = query.eq("updated_at", expected);
  if (body.action === "close") {
    // Close only a permit that is still open, and only if the filled columns are still as read.
    query = query.eq("status", "OPEN");
    for (const [column, value] of Object.entries(guards)) query = query.eq(column, value);
  }
  const { data, error } = await query.select("id, updated_at");
  if (error) {
    console.error("Updating a permit failed:", error);
    return bad("The permit could not be saved. Please try again.", 500);
  }
  if (!data || data.length === 0) {
    if (expected) {
      // Nothing was saved. Is it because someone else saved the permit first?
      const { data: now } = await supabase.from("permits").select("id, updated_at, deleted_at").eq("id", id).maybeSingle();
      if (now && now.updated_at !== expected) {
        return Response.json(
          {
            error: now.deleted_at
              ? "This permit was moved to the trash by someone else. Your changes were not saved."
              : "Someone else changed this permit while you were editing. Your changes were NOT saved, so theirs are not lost. Reload to see their version, then make your changes again.",
            code: "conflict",
          },
          { status: 409 }
        );
      }
    }
    if (body.action === "close") {
      const { data: now } = await supabase.from("permits").select("status, deleted_at, holder, issuer, area_authority").eq("id", id).maybeSingle();
      const changed = !now || now.deleted_at || now.status !== "OPEN" || Object.entries(guards).some(([column, value]) => (now[column] ?? "") !== value);
      if (changed) return bad("Someone else changed this permit a moment ago. Reload the page and try again.", 409);
    }
    return bad("You are not allowed to change this permit.", 403);
  }
  return Response.json({ ok: true, updatedAt: data[0].updated_at });
}

// "Delete" = move to the trash (nothing is erased). Root and HSE can restore it
// from the Trash page; only Root can delete it for good (/api/trash/purge).
export async function DELETE(request, { params }) {
  const id = parseId(params);
  if (!id) return bad("Unknown permit.");
  const viewer = await getViewer();
  if (!viewer) return bad("Not authenticated.", 401);

  const supabase = getSupabase();
  const { data: permit } = await supabase.from("permits").select("id, deleted_at").eq("id", id).maybeSingle();
  if (!permit) return bad("This permit does not exist.", 404);
  if (permit.deleted_at) return bad("This permit is already in the trash.", 409);

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("permits")
    .update({ deleted_at: now, deleted_by: viewer.staffId, updated_at: now })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) {
    console.error("Moving a permit to the trash failed:", error);
    return bad("The permit could not be moved to the trash. Please try again.", 500);
  }
  if (!data || data.length === 0) return bad("You are not allowed to delete this permit.", 403);
  return Response.json({ ok: true });
}
