import { createAdminClient } from "../../../../lib/supabase/admin";
import { cleanStaffId } from "../../../../lib/authRules";
import { clientIp, isRateLimited } from "../../../../lib/rateLimit";

// Public route. No email is sent: the request just appears in the admin
// panel (Admin -> Password requests). The reply is always the same, so
// the form can't be used to find out which Staff IDs exist.
const REPLY = { ok: true };

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body || body.website) return Response.json(REPLY);

  const staffId = cleanStaffId(body.staffId);
  if (!staffId) {
    return Response.json({ error: "Enter a valid Staff ID." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    if (await isRateLimited(admin, `forgot:${clientIp(request)}`, 5, 60)) {
      return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }
    if (await isRateLimited(admin, "forgot:all", 100, 24 * 60)) {
      return Response.json(REPLY);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("staff_id", staffId)
      .eq("status", "active")
      .maybeSingle();

    if (profile) {
      // A second open request for the same person is simply ignored
      // (unique index), so repeats never pile up.
      const { error } = await admin
        .from("password_reset_requests")
        .insert({ staff_id: staffId });
      if (error && error.code !== "23505") throw error;
    }
    return Response.json(REPLY);
  } catch (err) {
    console.error("Forgot password failed:", err);
    return Response.json({ error: "Server error. Try again later." }, { status: 500 });
  }
}
