import { getSupabase } from "../../../../lib/db";
import { deleteObject } from "../../../../lib/storage";
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
    .select("id, reference, status, closed_at")
    .eq("id", id)
    .maybeSingle();
  if (readError || !permit) return bad("This permit does not exist.", 404);

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

// DELETE body: { confirm: "<permit number>" }  (typed by the person)
// Removes the permit, its attachment records, and its files in Cloudinary.
export async function DELETE(request, { params }) {
  const id = parseId(params);
  if (!id) return bad("Unknown permit.");
  const body = await request.json().catch(() => null);

  const supabase = getSupabase();
  const { data: permit } = await supabase.from("permits").select("id, reference").eq("id", id).maybeSingle();
  if (!permit) return bad("This permit does not exist.", 404);

  const typed = String(body?.confirm ?? "").trim().toUpperCase();
  if (typed !== String(permit.reference).trim().toUpperCase()) {
    return bad("Type the permit number exactly to confirm.", 400);
  }

  const { data: files } = await supabase
    .from("permit_files")
    .select("storage_path, content_type")
    .eq("permit_id", id);

  // Database first: the permit (and its file records, by cascade) disappears.
  const { data: removed, error } = await supabase.from("permits").delete().eq("id", id).select("id");
  if (error) {
    console.error("Deleting a permit failed:", error);
    return bad("The permit could not be deleted. Please try again.", 500);
  }
  if (!removed || removed.length === 0) return bad("You are not allowed to delete this permit.", 403);

  // Then the stored files. A failure here leaves a stray private file in Cloudinary
  // but no permit points to it; the paths are logged so it can be cleaned up.
  const list = files || [];
  const results = await Promise.allSettled(
    list.map((f) => deleteObject(f.storage_path, { contentType: f.content_type }))
  );
  const failedPaths = list.filter((_, i) => results[i].status === "rejected").map((f) => f.storage_path);
  if (failedPaths.length) console.error("Permit deleted but these Cloudinary files remain:", failedPaths);

  return Response.json({ ok: true, filesDeleted: list.length - failedPaths.length, filesNotRemoved: failedPaths.length });
}
