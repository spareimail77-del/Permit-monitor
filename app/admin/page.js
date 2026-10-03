import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "../components/Header";
import Icon from "../components/Icon";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import { getAccess, hasPermission } from "../../lib/authz";
import { fetchPermitData } from "../../lib/parsePermits";
import { buildPeopleIndex } from "../../lib/people";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already enforces this; kept here too per Next.js's own
  // recommendation, not as a replacement for it.
  if (!user) redirect("/login");

  const access = await getAccess(supabase, user.id);

  if (!hasPermission(access, "view_admin_page")) redirect("/");

  let openRequests = 0;
  if (hasPermission(access, "reset_passwords")) {
    const { count } = await supabase
      .from("password_reset_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");
    openRequests = count || 0;
  }

  let pendingUsers = 0;
  let openIdChanges = 0;
  let unlinkedNames = null; // null = not shown / not available
  if (hasPermission(access, "approve_requests")) {
    const admin = createAdminClient();
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingUsers = count || 0;

    // Missing table (migration not run yet) just shows 0.
    const { count: idCount } = await admin
      .from("staff_id_change_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");
    openIdChanges = idCount || 0;
  }

  if (hasPermission(access, "manage_people_links")) {
    try {
      const [data, links] = await Promise.all([
        fetchPermitData(),
        createAdminClient().from("excel_name_links").select("excel_name"),
      ]);
      if (!data.error && !links.error) {
        const linked = new Set((links.data || []).map((l) => l.excel_name));
        unlinkedNames = buildPeopleIndex(data.permits).filter((e) => !linked.has(e.key)).length;
      }
    } catch (err) {
      unlinkedNames = null;
    }
  }

  return (
    <main style={styles.main}>
      <Header />
      <section style={styles.body}>
        <h2 style={styles.heading}>Admin</h2>
        <p style={styles.subheading}>Tools for HSE and management.</p>

        <div style={styles.grid}>
          {hasPermission(access, "upload_excel") && (
            <Link prefetch={false} href="/upload" className="panel admin-tile" style={styles.tile}>
            <span style={styles.tileIcon}>
              <Icon name="archive" size={20} />
            </span>
            <span>
              <span style={styles.tileTitle}>Upload Data</span>
              <span style={styles.tileText}>
                Replace the permit log, and see who uploaded what and when.
              </span>
            </span>
          </Link>
          )}
          {hasPermission(access, "view_archive") && (
          <Link prefetch={false} href="/admin/archive" className="panel admin-tile" style={styles.tile}>
            <span style={styles.tileIcon}>
              <Icon name="archive" size={20} />
            </span>
            <span>
              <span style={styles.tileTitle}>Permit Archive</span>
              <span style={styles.tileText}>
                Copy of every uploaded permit; shows the ones no longer in the log.
              </span>
            </span>
          </Link>
          )}
          {hasPermission(access, "approve_requests") && (
            <Link prefetch={false} href="/admin/users" className="panel admin-tile" style={styles.tile}>
              <span style={styles.tileIcon}>
                <Icon name="users" size={20} />
              </span>
              <span>
                <span style={styles.tileTitle}>Users</span>
                <span style={styles.tileText}>
                  {pendingUsers} waiting for approval.{" "}
                  Accept requests, roles, disable, reset, delete.
                </span>
              </span>
            </Link>
          )}
          {hasPermission(access, "approve_requests") && (
            <Link prefetch={false} href="/admin/id-changes" className="panel admin-tile" style={styles.tile}>
              <span style={styles.tileIcon}>
                <Icon name="tag" size={20} />
              </span>
              <span>
                <span style={styles.tileTitle}>Staff ID changes</span>
                <span style={styles.tileText}>
                  {openIdChanges} waiting. Approve a corrected Staff ID; history moves with it.
                </span>
              </span>
            </Link>
          )}
          {hasPermission(access, "manage_people_links") && (
            <Link prefetch={false} href="/admin/people" className="panel admin-tile" style={styles.tile}>
              <span style={styles.tileIcon}>
                <Icon name="users" size={20} />
              </span>
              <span>
                <span style={styles.tileTitle}>People &amp; Excel names</span>
                <span style={styles.tileText}>
                  {unlinkedNames === null
                    ? "Link accounts to the Applicant and Holder names in the log."
                    : `${unlinkedNames} name${unlinkedNames === 1 ? "" : "s"} without an account. Link them so people see their own permits.`}
                </span>
              </span>
            </Link>
          )}
          {hasPermission(access, "view_activity") && (
            <Link prefetch={false} href="/admin/activity" className="panel admin-tile" style={styles.tile}>
              <span style={styles.tileIcon}>
                <Icon name="clock" size={20} />
              </span>
              <span>
                <span style={styles.tileTitle}>Activity</span>
                <span style={styles.tileText}>
                  Which pages people opened, and when.
                </span>
              </span>
            </Link>
          )}
          {hasPermission(access, "reset_passwords") && (
            <Link prefetch={false} href="/admin/password-requests" className="panel admin-tile" style={styles.tile}>
              <span style={styles.tileIcon}>
                <Icon name="lock" size={20} />
              </span>
              <span>
                <span style={styles.tileTitle}>Password requests</span>
                <span style={styles.tileText}>
                  {openRequests} open. Set a temporary password for people who forgot theirs.
                </span>
              </span>
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}

const styles = {
  main: { minHeight: "100svh" },
  body: { maxWidth: 1120, margin: "0 auto", padding: "32px 20px" },
  heading: { margin: 0, fontSize: "var(--font-size-xl)", color: "var(--color-ink)" },
  subheading: {
    margin: "6px 0 24px",
    color: "var(--color-ink-muted)",
    fontSize: "var(--font-size-sm)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 14,
  },
  tile: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "18px 20px",
    textDecoration: "none",
    color: "inherit",
  },
  tileIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 38,
    height: 38,
    borderRadius: "var(--radius-sm)",
    background: "var(--color-brand-tint)",
    color: "var(--color-brand-2)",
    flexShrink: 0,
  },
  tileTitle: {
    display: "block",
    fontWeight: 700,
    fontSize: "var(--font-size-sm)",
    color: "var(--color-ink)",
    marginBottom: 4,
  },
  tileText: {
    display: "block",
    fontSize: "var(--font-size-xs)",
    color: "var(--color-ink-muted)",
  },
};
