import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { getAccess, hasPermission } from "../../../../lib/authz";

// Body: { days: 3 | 5 | 7 } — how long the activity log is kept.
// Root only. Saves the setting and deletes anything older right away.
export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const access = await getAccess(supabase, user.id);
  if (!hasPermission(access, "view_activity")) {
    return Response.json({ error: "You do not have permission to do that." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const days = Number(body.days);
  if (![3, 5, 7].includes(days)) {
    return Response.json({ error: "Choose 3, 5 or 7 days." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("activity_settings")
      .upsert({ id: 1, retention_days: days });
    if (error) throw error;

    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const { error: delError } = await admin.from("user_activity").delete().lt("at", cutoff);
    if (delError) throw delError;

    return Response.json({ ok: true, days });
  } catch (err) {
    console.error("Activity settings failed:", err);
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}
