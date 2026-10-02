import { Suspense } from "react";
import { redirect } from "next/navigation";
import Header from "../components/Header";
import { SkeletonLines, SkeletonPanel } from "../components/Skeleton";
import ProfileHero from "./ProfileHero";
import ProfileTabs from "./ProfileTabs";
import DetailsCard from "./DetailsCard";
import AccessCard from "./AccessCard";
import MySnapshot from "./MySnapshot";
import RecentUploads from "./RecentUploads";
import PasswordCard from "./PasswordCard";
import SessionCard from "./SessionCard";
import ThemePicker from "./ThemePicker";
import StartPagePref from "./StartPagePref";
import { createClient } from "../../lib/supabase/server";
import { can, roleLabel } from "../../lib/permissions";
import { formatWhen } from "../../lib/format";

export const dynamic = "force-dynamic";

const TABS = ["overview", "security", "preferences"];
const RECENT_DAYS = 14; // how long a decided Staff ID request is still shown

export default async function ProfilePage({ searchParams }) {
  const tab = TABS.includes(searchParams?.tab) ? searchParams.tab : "overview";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The tab is part of the address, and only the open tab loads its own data.
  const [{ data: profile }, linksRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("staff_id, display_name, role, status, created_at")
      .eq("id", user.id)
      .single(),
    // Which Excel names are linked to this account (HSE links them).
    supabase.from("excel_name_links").select("excel_name").eq("user_id", user.id),
  ]);
  if (!profile || profile.status !== "active") redirect("/login");

  const linkedNames = (linksRes.data || []).map((r) => r.excel_name).sort();
  const lastSignIn = formatWhen(user.last_sign_in_at);

  // ---- Overview: the person's own Staff ID change requests ----
  let openRequest = null;
  let recent = null;
  let idChangeAvailable = true;
  if (tab === "overview") {
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

  const fallback = (
    <SkeletonPanel>
      <SkeletonLines count={3} />
    </SkeletonPanel>
  );

  return (
    <main style={{ minHeight: "100svh" }}>
      <Header />
      <section className="pf-wrap">
        <ProfileHero
          name={profile.display_name || ""}
          staffId={profile.staff_id || ""}
          role={roleLabel(profile.role)}
          createdAt={profile.created_at}
          lastSignIn={lastSignIn}
        />
        <ProfileTabs active={tab} />

        {tab === "overview" && (
          <div className="pf-cols">
            <div className="pf-stack">
              {(linkedNames.length > 0 || profile.role === "permit_user") && (
                <Suspense fallback={fallback}>
                  <MySnapshot names={linkedNames} role={profile.role} />
                </Suspense>
              )}
              <DetailsCard
                staffId={profile.staff_id || ""}
                name={profile.display_name || ""}
                role={roleLabel(profile.role)}
                linkedNames={linkedNames}
                idChangeAvailable={idChangeAvailable}
                openRequest={shape(openRequest)}
                recent={shape(recent)}
              />
            </div>
            <div className="pf-stack">
              <AccessCard role={profile.role} />
              {can(profile.role, "upload_excel") && (
                <Suspense fallback={fallback}>
                  <RecentUploads userId={user.id} />
                </Suspense>
              )}
            </div>
          </div>
        )}

        {tab === "security" && (
          <div className="pf-stack pf-narrow">
            <PasswordCard />
            <SessionCard lastSignIn={lastSignIn} />
          </div>
        )}

        {tab === "preferences" && (
          <div className="pf-stack pf-narrow">
            <ThemePicker />
            {/* "Open on My permits" only makes sense for someone who can be a
                Holder or Applicant, so a Manager with no linked name never sees it. */}
            {!(profile.role === "manager" && linkedNames.length === 0) && (
              <StartPagePref hasLinks={linkedNames.length > 0} />
            )}
          </div>
        )}
      </section>
    </main>
  );
}
