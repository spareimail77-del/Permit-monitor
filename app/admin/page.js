import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "../components/Header";
import Icon from "../components/Icon";
import { createClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already enforces this; kept here too per Next.js's own
  // recommendation, not as a replacement for it.
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");

  return (
    <main style={styles.main}>
      <Header />
      <section style={styles.body}>
        <h2 style={styles.heading}>Admin</h2>
        <p style={styles.subheading}>Tools only HSE admins can see.</p>

        <div style={styles.grid}>
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
