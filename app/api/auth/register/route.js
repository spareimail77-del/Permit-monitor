import { createAdminClient } from "../../../../lib/supabase/admin";
import { staffIdToAuthEmail } from "../../../../lib/staffAuth";
import { cleanName, cleanStaffId, passwordProblem } from "../../../../lib/authRules";
import { allowed, clientIp } from "../../../../lib/rateLimit";

const MAX_PENDING = 40;

// A person asks for an account. It is created as 'pending' (the database
// trigger does that), so it cannot sign in until Root approves it.
export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "Could not read the form." }, { status: 400 });

  // Hidden trap field: real people leave it empty. Pretend it worked.
  if (String(body.website ?? "").trim() !== "") return Response.json({ ok: true });

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Account requests are not available right now." }, { status: 500 });
  }

  const ip = clientIp(request);
  if (!(await allowed(admin, `register-ip:${ip}`, 5, 3600)) || !(await allowed(admin, "register-day", 60, 86400))) {
    return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const staffId = cleanStaffId(body.staffId);
  const name = cleanName(body.displayName);
  if (!staffId) return Response.json({ error: "Staff ID must be 3 to 12 letters or digits.", field: "staffId" }, { status: 400 });
  if (!name) return Response.json({ error: "Name must be 2 to 40 characters.", field: "displayName" }, { status: 400 });
  const problem = passwordProblem(body.password);
  if (problem) return Response.json({ error: problem, field: "password" }, { status: 400 });

  const { count: pending } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if ((pending ?? 0) >= MAX_PENDING) {
    return Response.json({ error: "Too many requests are waiting. Please ask Root to clear them first." }, { status: 429 });
  }

  const taken = () =>
    Response.json({ error: "That Staff ID already has an account or a request waiting.", field: "staffId" }, { status: 409 });

  const { data: existing } = await admin.from("profiles").select("id").eq("staff_id", staffId).maybeSingle();
  if (existing) return taken();

  const { error } = await admin.auth.admin.createUser({
    email: staffIdToAuthEmail(staffId),
    password: body.password,
    email_confirm: true, // no email is ever sent
    user_metadata: { display_name: name },
  });
  if (error) {
    if (/already|registered|exists/i.test(error.message || "")) return taken();
    console.error("Creating the account failed:", error);
    return Response.json({ error: "The request could not be saved. Please try again." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
