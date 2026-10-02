import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "../../components/Header";
import PeopleLinks from "./PeopleLinks";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { getAccess, hasPermission } from "../../../lib/authz";
import { fetchPermitData } from "../../../lib/parsePermits";
import { buildPeopleIndex, suggestAccount } from "../../../lib/people";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getAccess(supabase, user.id);
  if (!hasPermission(access, "manage_people_links")) redirect("/");

  const admin = createAdminClient();
  const [data, accountsRes, linksRes] = await Promise.all([
    fetchPermitData(),
    admin
      .from("profiles")
      .select("id, staff_id, display_name, role, status")
      .eq("status", "active")
      .limit(1000),
    admin.from("excel_name_links").select("excel_name, user_id"),
  ]);

  const problem = !!linksRes.error;
  const accounts = (accountsRes.data || [])
    .map((a) => ({
      id: a.id,
      role: a.role,
      name: a.display_name || "",
      label: `${a.staff_id} · ${a.display_name || "no name"}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const linkByName = new Map((linksRes.data || []).map((l) => [l.excel_name, l.user_id]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  // Names found in the Applicant / Holder columns of the current file.
  const index = data.error ? [] : buildPeopleIndex(data.permits);
  const inFile = new Set(index.map((e) => e.key));

  const rows = index.map((e) => {
    const userId = linkByName.get(e.key) || null;
    const suggestion = userId ? null : suggestAccount(e.label, accounts);
    return {
      key: e.key,
      label: e.label,
      holderCount: e.holderCount,
      applicantCount: e.applicantCount,
      inFile: true,
      userId,
      suggestion,
    };
  });

  // Links to names that are not in the current file (kept in case they return).
  for (const [key, userId] of linkByName) {
    if (!inFile.has(key)) {
      rows.push({ key, label: key, holderCount: 0, applicantCount: 0, inFile: false, userId, suggestion: null });
    }
  }

  // Permit users who have no Excel name yet: they see nothing under "My permits".
  const linkedUserIds = new Set(linkByName.values());
  const unlinkedAccounts = accounts
    .filter((a) => a.role === "permit_user" && !linkedUserIds.has(a.id))
    .map((a) => a.label);

  return (
    <main style={{ minHeight: "100svh" }}>
      <Header />
      <section style={{ maxWidth: 840, margin: "0 auto", padding: "32px 20px 48px" }}>
        <p style={{ margin: 0, fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" }}>
          <Link prefetch={false} href="/admin" style={{ color: "var(--color-brand-2)" }}>Admin</Link> / People &amp; Excel names
        </p>
        <h2 style={{ margin: "6px 0 0", fontSize: "var(--font-size-xl)", color: "var(--color-ink)" }}>
          People &amp; Excel names
        </h2>
        <p style={{ margin: "6px 0 20px", color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
          Match each name from the Applicant and Holder lists in the Excel log to a person&apos;s account. That
          person then sees their own permits on the dashboard and can filter the Permit List to them.
        </p>

        {problem ? (
          <p className="notice">
            The links could not be read. Run <span className="mono">step36-excel-name-links.sql</span> in Supabase
            (SQL Editor) once, then reload this page.
          </p>
        ) : data.error && rows.length === 0 ? (
          <p className="notice">The permit file could not be read yet, so there are no names to link.</p>
        ) : (
          <PeopleLinks rows={rows} accounts={accounts.map((a) => ({ id: a.id, label: a.label }))} unlinkedAccounts={unlinkedAccounts} />
        )}
      </section>
    </main>
  );
}
