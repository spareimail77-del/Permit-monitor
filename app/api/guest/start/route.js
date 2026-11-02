import { randomBytes } from "node:crypto";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { GUEST_EMAIL_DOMAIN, hashToken, linkState, looksLikeToken } from "../../../../lib/guestLinks";

// Public: this is what the "Start guest view" button calls. It needs no login, only a valid
// guest link (the secret in the link). The link is used up atomically: two clicks, a double
// tap or two devices can never both start a session.
//
// What it does, in order:
//  1. checks the link (exists, not revoked, not expired, not used)
//  2. claims it in one database step (opened_at, expires_at)
//  3. creates a temporary account with the role "guest" that ends at expires_at
//  4. signs the browser in as that guest
// If step 3 or 4 fails the link is put back, so a technical problem does not burn the link.

const WHY = {
  revoked: "This link has been cancelled. Please ask for a new one.",
  never_opened: "This link has expired. Please ask for a new one.",
  active: "This link has already been used. Please ask for a new one.",
  ended: "This link has already been used. Please ask for a new one.",
};

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const token = body?.token;
  if (!looksLikeToken(token)) return Response.json({ error: "This link is not valid." }, { status: 400 });

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Guest links are not set up on this server yet." }, { status: 500 });
  }

  const supabase = createClient();

  // A browser that is already signed in: a guest session is replaced, anyone else is told to
  // use another window (starting a guest view here would sign that person out).
  const {
    data: { user: existing },
  } = await supabase.auth.getUser();
  if (existing) {
    const { data: who } = await admin.from("profiles").select("role").eq("id", existing.id).maybeSingle();
    if (who?.role !== "guest") {
      return Response.json(
        { error: "You are signed in to this browser. Open the guest link in a private window, or sign out first." },
        { status: 409 }
      );
    }
    await supabase.auth.signOut();
  }

  const hash = hashToken(token);
  const { data: link, error: readError } = await admin
    .from("guest_links")
    .select("id, label, link_valid_until, session_minutes, opened_at, expires_at, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (readError) {
    console.error("Reading a guest link failed:", readError);
    return Response.json({ error: "Could not check the link. Please try again." }, { status: 500 });
  }
  if (!link) return Response.json({ error: "This link is not valid." }, { status: 404 });

  const state = linkState(link);
  if (state !== "not_opened") return Response.json({ error: WHY[state] || "This link cannot be used." }, { status: 410 });

  // Claim it. The conditions are part of the UPDATE itself, so only one caller can win.
  const now = new Date();
  const expires = new Date(now.getTime() + link.session_minutes * 60 * 1000);
  const { data: claimed, error: claimError } = await admin
    .from("guest_links")
    .update({ opened_at: now.toISOString(), expires_at: expires.toISOString() })
    .eq("id", link.id)
    .is("opened_at", null)
    .is("revoked_at", null)
    .gt("link_valid_until", now.toISOString())
    .select("id");
  if (claimError) {
    console.error("Claiming a guest link failed:", claimError);
    return Response.json({ error: "Could not start. Please try again." }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    return Response.json({ error: "This link has already been used. Please ask for a new one." }, { status: 410 });
  }

  // From here on, any failure gives the link back.
  const giveBack = async (userId) => {
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
    await admin.from("guest_links").update({ opened_at: null, expires_at: null, guest_user_id: null }).eq("id", link.id);
  };

  const email = `guest-${randomBytes(6).toString("hex")}@${GUEST_EMAIL_DOMAIN}`;
  const password = randomBytes(32).toString("base64url");

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `Guest: ${link.label}`.slice(0, 40) },
  });
  if (createError || !created?.user) {
    console.error("Creating the guest account failed:", createError);
    await giveBack(null);
    return Response.json({ error: "Could not start. Please try again." }, { status: 500 });
  }
  const userId = created.user.id;

  // The sign-up trigger made an ordinary pending profile: turn it into the guest.
  const { data: updated, error: profileError } = await admin
    .from("profiles")
    .update({
      role: "guest",
      status: "active",
      display_name: `Guest: ${link.label}`.slice(0, 40),
      guest_expires_at: expires.toISOString(),
      must_change_password: false,
    })
    .eq("id", userId)
    .select("id");
  if (profileError || !updated || updated.length === 0) {
    console.error("Setting up the guest profile failed (has supabase/11-guest-links.sql been run?):", profileError);
    await giveBack(userId);
    return Response.json({ error: "Could not start. Has supabase/11-guest-links.sql been run?" }, { status: 500 });
  }

  await admin.from("guest_links").update({ guest_user_id: userId }).eq("id", link.id);

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    console.error("Signing in the guest failed:", signInError);
    await giveBack(userId);
    return Response.json({ error: "Could not start. Please try again." }, { status: 500 });
  }

  return Response.json({ ok: true, expiresAt: expires.toISOString() });
}
