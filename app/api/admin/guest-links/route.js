import { requireActive } from "../../../../lib/adminAuth";
import { LINK_CHOICES, SESSION_CHOICES, hashToken, newToken } from "../../../../lib/guestLinks";
import { oneLine } from "../../../../lib/permitRules";

// Root only (middleware: /api/admin needs manage_users; checked again here).
// Creates a guest link. The link is returned ONCE: only a scrambled copy is stored, so it
// can never be shown again. Body: { label, sessionMinutes, linkHours }.
export async function POST(request) {
  const a = await requireActive("manage_users");
  if (a.error) return a.error;
  const { profile, admin } = a;

  const body = await request.json().catch(() => null);
  const label = oneLine(body?.label, 60);
  const sessionMinutes = Number(body?.sessionMinutes);
  const linkHours = Number(body?.linkHours);
  if (!label) return Response.json({ error: "Give the link a name, for example the visitor or the visit." }, { status: 400 });
  if (!SESSION_CHOICES.some((c) => c.minutes === sessionMinutes)) return Response.json({ error: "Choose how long the guest can look around." }, { status: 400 });
  if (!LINK_CHOICES.some((c) => c.hours === linkHours)) return Response.json({ error: "Choose how long the link stays valid." }, { status: 400 });

  // Tidy up: guest accounts of sessions that ended more than a day ago are removed (best effort).
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: old } = await admin.from("guest_links").select("id, guest_user_id").not("guest_user_id", "is", null).lt("expires_at", cutoff).limit(50);
    for (const row of old || []) {
      await admin.auth.admin.deleteUser(row.guest_user_id).catch(() => {});
      await admin.from("guest_links").update({ guest_user_id: null }).eq("id", row.id);
    }
  } catch {
    // Not important: the next time will try again.
  }

  const token = newToken();
  const { data, error } = await admin
    .from("guest_links")
    .insert({
      label,
      token_hash: hashToken(token),
      created_by: profile.staff_id || "",
      link_valid_until: new Date(Date.now() + linkHours * 60 * 60 * 1000).toISOString(),
      session_minutes: sessionMinutes,
    })
    .select("id")
    .single();
  if (error) {
    console.error("Creating a guest link failed:", error);
    return Response.json({ error: "Could not create the link. Has supabase/11-guest-links.sql been run?" }, { status: 500 });
  }

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin;
  return Response.json({ ok: true, id: data.id, url: `${origin}/guest/${token}` });
}
