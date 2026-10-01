import { redirect } from "next/navigation";
import Header from "../components/Header";
import ProfileForms from "./ProfileForms";
import { createClient } from "../../lib/supabase/server";
import { roleLabel } from "../../lib/permissions";

export const dynamic = "force-dynamic";

const RECENT_DAYS = 14; // how long a decided request is still shown

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("staff_id, display_name, role, status")
    .eq("id", user.id)
    .single();
  if (!profile || profile.status !== "active") redirect("/login");

  // The person's own requests (a database rule lets everyone read only their
  // own). If the table is missing (migration not run yet) the page still
  // works and the Staff ID section says it is not available.
  let openRequest = null;
  let recent = null;
  let idChangeAvailable = true;
  try {
    const { data, error } = await supabase
      .from("staff_id_change_requests")
      .select("id, old_staff_id, new_staff_id, reason, status, decision_note, requested_at, decided_at")
      .order("requested_at", { ascending: false })
      .limit(5);
    if (error) {
      idChangeAvailable = false;
    } else {
      const rows = data || [];
      openRequest = rows.find((r) => r.status === "open") || null;
      const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
      recent =
        rows.find(
          (r) =>
            (r.status === "approved" || r.status === "rejected") &&
            r.decided_at &&
            Date.parse(r.decided_at) > cutoff
        ) || null;
    }
  } catch (err) {
    idChangeAvailable = false;
  }

  const shape = (r) =>
    r && {
      oldStaffId: r.old_staff_id,
      newStaffId: r.new_staff_id,
      reason: r.reason || "",
      status: r.status,
      note: r.decision_note || "",
      requestedAt: r.requested_at,
      decidedAt: r.decided_at,
    };

  return (
    <main style={{ minHeight: "100svh" }}>
      <Header />
      <section style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 48px" }}>
        <h2 style={{ margin: 0, fontSize: "var(--font-size-xl)", color: "var(--color-ink)" }}>My profile</h2>
        <p style={{ margin: "6px 0 20px", color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
          Correct your name here. A different Staff ID needs approval from an admin, so your history stays with you.
        </p>
        <ProfileForms
          staffId={profile.staff_id || ""}
          name={profile.display_name || ""}
          role={roleLabel(profile.role)}
          idChangeAvailable={idChangeAvailable}
          openRequest={shape(openRequest)}
          recent={shape(recent)}
        />
      </section>
    </main>
  );
}
