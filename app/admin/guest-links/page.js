import { guardAdminPage } from "../../../lib/adminPage";
import { getAdminCounts } from "../../../lib/adminCounts";
import { omanDateTime } from "../../../lib/format";
import { LINK_CHOICES, SESSION_CHOICES, linkState } from "../../../lib/guestLinks";
import AdminNav from "../../components/AdminNav";
import PageHeader from "../../components/PageHeader";
import KeyMissing from "../KeyMissing";
import GuestLinksManager from "./GuestLinksManager";

export const dynamic = "force-dynamic";

export default async function GuestLinksPage() {
  const { admin } = await guardAdminPage();
  if (!admin) return <KeyMissing />;

  const [{ data, error }, counts] = await Promise.all([
    admin
      .from("guest_links")
      .select("id, label, created_by, created_at, link_valid_until, session_minutes, opened_at, expires_at, revoked_at")
      .order("id", { ascending: false })
      .limit(200),
    getAdminCounts(admin),
  ]);

  const now = new Date();
  const rows = (data || []).map((l) => {
    const state = linkState(l, now);
    const minutesLeft = state === "active" ? Math.max(1, Math.ceil((new Date(l.expires_at) - now) / 60000)) : null;
    return {
      id: l.id,
      label: l.label,
      state,
      minutesLeft,
      sessionMinutes: l.session_minutes,
      createdBy: l.created_by,
      created: omanDateTime(l.created_at),
      validUntil: omanDateTime(l.link_valid_until),
      opened: l.opened_at ? omanDateTime(l.opened_at) : "",
      expires: l.expires_at ? omanDateTime(l.expires_at) : "",
    };
  });

  return (
    <>
      <PageHeader
        title="Guest links"
        crumbs={[{ label: "Dashboard", href: "/" }, { label: "Admin", href: "/admin" }, { label: "Guest links" }]}
        sub="Let someone look around the site without an account: read only, for a limited time."
      />
      <AdminNav active="guests" counts={counts} />
      {error && (
        <div className="notice notice--danger">
          The guest links could not be read. Has <span className="mono">supabase/11-guest-links.sql</span> been run?
        </div>
      )}
      <GuestLinksManager rows={rows} sessionChoices={SESSION_CHOICES} linkChoices={LINK_CHOICES} />
    </>
  );
}
