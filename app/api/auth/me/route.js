import { createClient } from "../../../../lib/supabase/server";
import { getCurrentUser } from "../../../../lib/supabase/user";

export async function GET() {
  const supabase = createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return Response.json({ user: null }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("staff_id, role, status, display_name")
    .eq("id", user.id)
    .single();

  if (profile?.status !== "active") {
    return Response.json({ user: null }, { status: 403 });
  }

  return Response.json({
    staffId: profile?.staff_id || null,
    role: profile?.role || "permit_user",
    // Falls back to the staff ID when nobody has set a friendly name yet.
    displayName: profile?.display_name || profile?.staff_id || "User",
  });
}
