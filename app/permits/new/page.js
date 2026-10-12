import { redirect } from "next/navigation";
import PageHeader from "../../components/PageHeader";
import PermitForm from "../../components/PermitForm";
import { getViewer } from "../../../lib/viewer";
import { getSupabase, fetchOptions } from "../../../lib/db";

export const dynamic = "force-dynamic";

export default async function NewPermitPage() {
  const viewer = await getViewer();
  if (!viewer?.canManagePermits) redirect("/permits");

  const supabase = getSupabase();
  const [{ lists, error }, { data: refs }] = await Promise.all([
    fetchOptions(supabase),
    supabase.from("permits").select("reference").limit(5000),
  ]);

  return (
    <>
      <PageHeader
        title="New permit"
        crumbs={[{ label: "Dashboard", href: "/" }, { label: "Permits", href: "/permits" }, { label: "New permit" }]}
        sub="Fields marked * are required."
      />
      {error && (
        <div className="notice notice--danger">
          The dropdown lists could not be loaded. Has <span className="mono">supabase/01-permits.sql</span> been run?
        </div>
      )}
      <PermitForm options={lists} existingRefs={(refs || []).map((r) => r.reference)} />
    </>
  );
}
