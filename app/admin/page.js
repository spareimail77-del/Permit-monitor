import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "../components/Header";
import Icon from "../components/Icon";
import { createClient } from "../../lib/supabase/server";
import { getAccess, hasPermission } from "../../lib/authz";

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

  return (
    <main style={styles.main}>
      <Header />
      <section style={styles.body}>
        <h2 style={styles.heading}>Admin</h2>
        <p style={styles.subheading}>Tools for HSE and management.</p>

        <div style={styles.grid}>
          {hasPermission(access, "upload_excel") && (
            <Link href="/upload" className="panel" style={styles.tile}>
            <span style={styles.tileIcon}>
              <Icon name="archive" size={20} />
            </span>
            <span>
              <span style={styles.tileTitle}>Upload Data</span>
              <span style={styles.tileText}>
                Replace the permit log the dashboard reads from.
              </span>
            </span>
          </Link>
          )}
          {hasPermission(access, "view_archive") && (
          <Link href="/admin/archive" className="panel" style={styles.tile}>
            <span style={styles.tileIcon}>
              <Icon name="archive" size={20} />
            </span>
            <span>
              <span style={styles.tileTitle}>Permit Archive</span>
              <span style={styles.tileText}>
                Permits removed from the Excel file, kept for reference.
              </span>
            </span>
          </Link>
          )}
          {hasPermission(access, "reset_passwords") && (
            <Link href="/admin/password-requests" className="panel" style={styles.tile}>
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
