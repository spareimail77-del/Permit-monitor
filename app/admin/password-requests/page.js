import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "../../components/Header";
import RequestsList from "./RequestsList";
import { createClient } from "../../../lib/supabase/server";
import { getAccess, hasPermission } from "../../../lib/authz";

export const dynamic = "force-dynamic";

export default async function PasswordRequestsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getAccess(supabase, user.id);
  if (!hasPermission(access, "reset_passwords")) redirect("/");

  const { data: requests } = await supabase
    .from("password_reset_requests")
    .select("id, staff_id, requested_at")
    .eq("status", "open")
    .order("requested_at", { ascending: true })
    .limit(100);
  const open = requests || [];

  // Names for the requesters (root can read all profiles).
  let names = {};
  if (open.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("staff_id, display_name")
      .in("staff_id", open.map((r) => r.staff_id));
    for (const p of profiles || []) names[p.staff_id] = p.display_name || "";
  }

  const rows = open.map((r) => ({
    id: r.id,
    staffId: r.staff_id,
    name: names[r.staff_id] || "",
    requestedAt: r.requested_at,
  }));

  return (
    <main style={{ minHeight: "100svh" }}>
      <Header />
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px" }}>
        <p style={{ margin: 0, fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" }}>
          <Link href="/admin" style={{ color: "var(--color-brand-2)" }}>Admin</Link> / Password requests
        </p>
        <h2 style={{ margin: "6px 0 0", fontSize: "var(--font-size-xl)", color: "var(--color-ink)" }}>
          Password requests
        </h2>
        <p style={{ margin: "6px 0 20px", color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
          Setting a temporary password makes the person choose a new one at next sign-in.
          Give it to them in person or by phone.
        </p>
        <RequestsList initial={rows} />
      </section>
    </main>
  );
}
