import { guardAdminPage } from "../../../lib/adminPage";
import { getAdminCounts } from "../../../lib/adminCounts";
import { omanDateTime } from "../../../lib/format";
import AdminNav from "../../components/AdminNav";
import PageHeader from "../../components/PageHeader";
import KeyMissing from "../KeyMissing";
import UsersList from "./UsersList";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const { viewer, admin } = await guardAdminPage();
  if (!admin) return <KeyMissing />;

  const [{ data, error }, counts] = await Promise.all([
    admin.from("profiles").select("id, staff_id, display_name, role, status, must_change_password, created_at").order("created_at", { ascending: false }).limit(1000),
    getAdminCounts(admin),
  ]);

  const users = (data || []).map((u) => ({
    id: u.id,
    staffId: u.staff_id || "",
    name: u.display_name || "",
    role: u.role,
    status: u.status,
    mustChange: !!u.must_change_password,
    created: omanDateTime(u.created_at),
  }));

  return (
    <>
      <PageHeader
        title="Users"
        crumbs={[{ label: "Dashboard", href: "/" }, { label: "Admin", href: "/admin" }, { label: "Users" }]}
        sub="Accounts waiting for approval come first."
      />
      <AdminNav active="users" counts={counts} />
      {error && (
        <div className="notice notice--danger">
          The users could not be read. Has <span className="mono">supabase/04-users-admin.sql</span> been run?
        </div>
      )}
      <UsersList users={users} selfId={viewer.id} />
    </>
  );
}
