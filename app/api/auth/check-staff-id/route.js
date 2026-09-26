import { createAdminClient } from "../../../../lib/supabase/admin";
import { isValidStaffId, normalizeStaffId } from "../../../../lib/staffAuth";

export async function POST(request) {
  const { staffId } = await request.json().catch(() => ({}));

  if (!isValidStaffId(staffId)) {
    return Response.json(
      { available: false, error: "Enter a valid staff ID." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("staff_id")
    .eq("staff_id", normalizeStaffId(staffId))
    .maybeSingle();

  if (error) {
    return Response.json({ available: false, error: "Could not check right now." }, { status: 500 });
  }

  return Response.json({ available: !data });
}
