import { createAdminClient } from "../../../../lib/supabase/admin";
import { staffIdToAuthEmail } from "../../../../lib/staffAuth";
import { DEFAULT_ROLE } from "../../../../lib/permissions";
import { cleanStaffId, cleanName, passwordProblem } from "../../../../lib/authRules";
import { clientIp, isRateLimited } from "../../../../lib/rateLimit";

const MAX_PENDING = 40; // stop a flood of requests from filling the database

// Public route (see middleware.js). Creates the login as PENDING; the
// person cannot sign in until an admin approves the request.
export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });

  // Hidden "website" field: real people leave it empty, simple bots fill it.
  if (body.website) return Response.json({ ok: true });

  const staffId = cleanStaffId(body.staffId);
  const name = cleanName(body.name);
  const problem = passwordProblem(body.password);

  if (!staffId) {
    return Response.json({ error: "Enter a valid Staff ID (3-12 letters or numbers)." }, { status: 400 });
  }
  if (!name) return Response.json({ error: "Enter your name (2-40 characters)." }, { status: 400 });
  if (problem) return Response.json({ error: problem }, { status: 400 });

  try {
    const admin = createAdminClient();

    if (await isRateLimited(admin, `register:${clientIp(request)}`, 5, 60)) {
      return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }
    if (await isRateLimited(admin, "register:all", 40, 24 * 60)) {
      return Response.json({ error: "Requests are paused for today. Contact HSE." }, { status: 429 });
    }

    const { count: pending } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    if ((pending || 0) >= MAX_PENDING) {
      return Response.json(
        { error: "Too many requests are waiting for approval. Contact HSE." },
        { status: 429 }
      );
    }

    // app_metadata can only be written from the server, so the database
    // trigger can trust it to create the profile as pending. The role is
    // always the ordinary user role; only Root can change it later.
    const { data, error } = await admin.auth.admin.createUser({
      email: staffIdToAuthEmail(staffId),
      password: body.password,
      email_confirm: true,
      app_metadata: { status: "pending", display_name: name },
    });

    if (error) {
      const exists = /already|registered|exists/i.test(error.message || "");
      return Response.json(
        {
          error: exists
            ? "This Staff ID already has an account or a pending request."
            : "Could not create the request. Try again later.",
        },
        { status: exists ? 409 : 500 }
      );
    }

    // Belt and braces: make sure the profile is pending with the ordinary
    // role and the right name even if the trigger ran before app_metadata
    // was readable.
    await admin
      .from("profiles")
      .update({ status: "pending", role: DEFAULT_ROLE, display_name: name })
      .eq("id", data.user.id);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Register failed:", err);
    return Response.json({ error: "Server error. Try again later." }, { status: 500 });
  }
}
