import { createClient } from "../../../../lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ user: null }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("staff_id, role, display_name")
    .eq("id", user.id)
    .single();

  return Response.json({
    staffId: profile?.staff_id || null,
    role: profile?.role || "user",
    // Falls back to the staff ID when nobody has set a friendly name yet.
    displayName: profile?.display_name || profile?.staff_id || "User",
  });
}
