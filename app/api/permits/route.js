import { getSupabase } from "../../../lib/db";
import { validatePermitInput } from "../../../lib/permitRules";

// Saves one new permit from the form. The same checks run in the browser
// (instant messages) and here (the real check).
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Could not read the form." }, { status: 400 });
  }

  const { errors, clean } = validatePermitInput(body);
  if (Object.keys(errors).length > 0) {
    return Response.json({ error: "Please fix the marked fields.", fields: errors }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("permits")
    .insert({
      reference: clean.reference,
      area: clean.area,
      location: clean.location,
      permit_type: clean.permitType,
      job_description: clean.jobDescription,
      certificates: clean.certificates, // [{ name, number }]
      applicant: clean.applicant,
      holder: clean.holder,
      issuer: clean.issuer,
      area_authority: clean.areaAuthority,
      controller: clean.controller,
      valid_from: clean.validFrom,
      valid_to: clean.validTo,
      status: "OPEN", // a new permit always starts open
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json(
        {
          error: `Permit number ${clean.reference} already exists (it may be in the trash).`,
          fields: { reference: "This permit number is already used." },
        },
        { status: 409 }
      );
    }
    console.error("Saving a permit failed:", error);
    return Response.json({ error: "The permit could not be saved. Please try again." }, { status: 500 });
  }

  return Response.json({ ok: true, id: data.id });
}
