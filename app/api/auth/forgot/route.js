import { createAdminClient } from "../../../../lib/supabase/admin";
import { cleanStaffId } from "../../../../lib/authRules";
import { allowed, clientIp } from "../../../../lib/rateLimit";

// No email on this site. A forgot-password request appears for Root, who sets a
// temporary password. The answer is always the same, so nobody can use this
// form to find out which Staff IDs exist.
const SAME_ANSWER = { ok: true };

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "Could not read the form." }, { status: 400 });
  if (String(body.website ?? "").trim() !== "") return Response.json(SAME_ANSWER);

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error(e);
    return Response.json({ error: "This is not available right now." }, { status: 500 });
  }

  if (!(await allowed(admin, `forgot-ip:${clientIp(request)}`, 5, 3600))) {
    return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const staffId = cleanStaffId(body.staffId);
  if (!staffId) return Response.json({ error: "Staff ID must be 3 to 12 letters or digits." }, { status: 400 });

  const { data: profile } = await admin.from("profiles").select("status").eq("staff_id", staffId).maybeSingle();
  if (profile?.status === "active") {
    // One open request per person: a second one hits the unique index and is ignored.
    const { error } = await admin.from("password_reset_requests").insert({ staff_id: staffId });
    if (error && error.code !== "23505") console.error("Saving a password request failed:", error);
  }
  return Response.json(SAME_ANSWER);
}
