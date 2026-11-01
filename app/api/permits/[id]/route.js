import { getSupabase } from "../../../../lib/db";
import { getViewerStrict as getViewer } from "../../../../lib/viewer";
import { todayOman } from "../../../../lib/omanDate";
import { statusPatch, validatePermitInput, validateStatusInput } from "../../../../lib/permitRules";
import { resolveLocation } from "../../../../lib/locationServer";

// Root and HSE only: middleware checks the URL (/api/permits needs
// manage_permits) and the database policies check again.

function parseId(params) {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}
const bad = (error, status = 400, extra = {}) => Response.json({ error, ...extra }, { status });

// PATCH body: { action: "edit", ...form fields, status, cancelReason }
//          or { action: "close" } | { action: "cancel", reason } | { action: "reopen" }
export async function PATCH(request, { params }) {
  const id = parseId(params);
  if (!id) return bad("Unknown permit.");
  const body = await request.json().catch(() => null);
  if (!body) return bad("Could not read the request.");

  const supabase = getSupabase();
  const { data: permit, error: readError } = await supabase
    .from("permits")
    .select("id, reference, status, closed_at, deleted_at, location")
    .eq("id", id)
    .maybeSingle();
  if (readError || !permit) return bad("This permit does not exist.", 404);
  if (permit.deleted_at) return bad("This permit is in the trash. Restore it first.", 409);

  const today = todayOman();
  let patch;

  if (body.action === "close") {
    if (permit.status !== "OPEN") return bad("Only an open permit can be closed.", 409);
    patch = statusPatch(permit, "CLOSED", "", today);
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
