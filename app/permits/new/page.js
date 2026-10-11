import PermitForm from "../../components/PermitForm";
import { getSupabase, fetchOptions } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

export default async function NewPermitPage() {
  const supabase = getSupabase();
  const [{ lists, error }, { data: refs }] = await Promise.all([
    fetchOptions(supabase),
    supabase.from("permits").select("reference").limit(5000),
  ]);

  return (
    <>
      <h2 className="page-title">New permit</h2>
      <p className="page-sub">Fields marked * are required.</p>
      {error && (
        <div className="notice">
          The dropdown lists could not be loaded. Has <span className="mono">supabase/01-permits.sql</span> been run?
        </div>
      )}
      <PermitForm options={lists} existingRefs={(refs || []).map((r) => r.reference)} />
    </>
  );
}
