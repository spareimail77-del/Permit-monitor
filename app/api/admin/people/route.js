import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { getAccess, hasPermission } from "../../../../lib/authz";
import { normName } from "../../../../lib/people";

// POST { excelName, userId }  -> link an Excel name to an account
//      (an Excel name belongs to one account; linking it again moves it)
// POST { excelName, userId: null } -> remove the link
// Root and HSE (permission manage_people_links; middleware and this route).
function fail(error, status) {
  return Response.json({ error }, { status });
}

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not authenticated.", 401);

  const access = await getAccess(supabase, user.id);
  if (!hasPermission(access, "manage_people_links")) {
    return fail("You do not have permission to do that.", 403);
  }

  const body = await request.json().catch(() => ({}));
  const excelName = normName(body.excelName);
  if (!excelName || excelName.length > 80) return fail("Invalid name.", 400);

  try {
    const admin = createAdminClient();

    if (body.userId === null || body.userId === "") {
      const { error } = await admin.from("excel_name_links").delete().eq("excel_name", excelName);
      if (error) return fail("Could not remove the link.", 500);
      return Response.json({ ok: true });
    }

    const userId = String(body.userId || "");
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return fail("Invalid account.", 400);

    const { data: target } = await admin
      .from("profiles")
      .select("id, status")
      .eq("id", userId)
      .single();
    if (!target) return fail("That account no longer exists.", 404);
    if (target.status !== "active") return fail("That account is not active.", 400);

    const { error } = await admin.from("excel_name_links").upsert(
      {
        excel_name: excelName,
        user_id: userId,
        linked_by: user.id,
        linked_at: new Date().toISOString(),
      },
      { onConflict: "excel_name" }
    );
    if (error) {
      console.error("Name link failed:", error.message);
      return fail("Could not save the link.", 500);
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Name link failed:", err);
    return fail("Server error.", 500);
  }
}
