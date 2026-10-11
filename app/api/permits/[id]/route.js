import { getSupabase } from "../../../../lib/db";
import { getViewer } from "../../../../lib/viewer";
import { todayOman } from "../../../../lib/omanDate";
import { statusPatch, validatePermitInput, validateStatusInput } from "../../../../lib/permitRules";

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
    .select("id, reference, status, closed_at, deleted_at")
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

  const { data, error } = await supabase
    .from("permits")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) {
    console.error("Updating a permit failed:", error);
    return bad("The permit could not be saved. Please try again.", 500);
  }
  if (!data || data.length === 0) return bad("You are not allowed to change this permit.", 403);
  return Response.json({ ok: true });
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
