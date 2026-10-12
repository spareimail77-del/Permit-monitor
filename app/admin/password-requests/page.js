import { guardAdminPage } from "../../../lib/adminPage";
import { getAdminCounts } from "../../../lib/adminCounts";
import { omanDateTime } from "../../../lib/format";
import AdminNav from "../../components/AdminNav";
import PageHeader from "../../components/PageHeader";
import KeyMissing from "../KeyMissing";
import RequestsList from "./RequestsList";

export const dynamic = "force-dynamic";

export default async function PasswordRequestsPage() {
  const { admin } = await guardAdminPage();
  if (!admin) return <KeyMissing />;

  const [{ data, error }, counts] = await Promise.all([
    admin.from("password_reset_requests").select("id, staff_id, status, created_at, resolved_by, resolved_at").order("id", { ascending: false }).limit(100),
    getAdminCounts(admin),
  ]);

  const names = {};
  const ids = [...new Set((data || []).map((r) => r.staff_id))];
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("staff_id, display_name").in("staff_id", ids);
    for (const p of profs || []) names[p.staff_id] = p.display_name || "";
  }

  const rows = (data || []).map((r) => ({
    id: r.id,
    staffId: r.staff_id,
    name: names[r.staff_id] || "",
    status: r.status,
    created: omanDateTime(r.created_at),
    resolvedBy: r.resolved_by || "",
    resolved: r.resolved_at ? omanDateTime(r.resolved_at) : "",
  }));

  return (
    <>
      <PageHeader
        title="Password requests"
        crumbs={[{ label: "Dashboard", href: "/" }, { label: "Admin", href: "/admin" }, { label: "Password requests" }]}
        sub="People who forgot their password. Set a temporary one and give it to them."
      />
      <AdminNav active="passwords" counts={counts} />
      {error && (
        <div className="notice notice--danger">
          Could not read the requests. Has <span className="mono">supabase/04-users-admin.sql</span> been run?
        </div>
      )}
      <RequestsList rows={rows} />
    </>
  );
}
