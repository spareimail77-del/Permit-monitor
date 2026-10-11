import { createClient } from "../../../lib/supabase/server";
import { cleanName } from "../../../lib/authRules";

// Changes the signed-in person's own display name (nothing else about the
// account can be changed here). Done through a database function, so a person
// can never change their own role or status.
export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = cleanName(body?.displayName);
  if (!name) return Response.json({ error: "Name must be 2 to 40 characters." }, { status: 400 });

  const { error } = await supabase.rpc("set_my_display_name", { p_name: name });
  if (error) {
    console.error("Saving the name failed:", error);
    return Response.json({ error: "The name could not be saved. Please try again." }, { status: 500 });
  }
  return Response.json({ ok: true, displayName: name });
}
