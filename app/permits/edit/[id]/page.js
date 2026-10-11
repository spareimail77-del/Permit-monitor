import Link from "next/link";
import { redirect } from "next/navigation";
import PermitForm from "../../../components/PermitForm";
import { getViewer } from "../../../../lib/viewer";
import { getSupabase, fetchOptions } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export default async function EditPermitPage({ params }) {
  const viewer = await getViewer();
  if (!viewer?.canManagePermits) redirect("/permits");

  const id = Number(params.id);
  const supabase = getSupabase();
  const { data: permit } =
    Number.isInteger(id) && id > 0
      ? await supabase.from("permits").select("*").eq("id", id).maybeSingle()
      : { data: null };

  if (!permit) {
    return (
      <>
        <h2 className="page-title">Permit not found</h2>
        <p className="page-sub">
          <Link href="/permits">Back to the permit list</Link>
        </p>
      </>
    );
  }

  if (permit.deleted_at) redirect(`/permits/${permit.id}`); // in the trash: restore it first

  const { lists, error } = await fetchOptions(supabase);
  const certs = Array.isArray(permit.certificates) ? permit.certificates : [];

  const initial = {
    values: {
      reference: permit.reference,
      area: permit.area || "",
      location: permit.location || "",
      permitType: permit.permit_type || "",
      jobDescription: permit.job_description || "",
      applicant: permit.applicant || "",
      holder: permit.holder || "",
      issuer: permit.issuer || "",
      areaAuthority: permit.area_authority || "",
      controller: permit.controller || "",
      validFrom: permit.valid_from || "",
      validTo: permit.valid_to || "",
    },
    certs: certs.map((c) => c.name),
    certNumbers: Object.fromEntries(certs.map((c) => [c.name, c.number || ""])),
    status: permit.status,
    cancelReason: permit.cancel_reason || "",
  };

  return (
    <>
      <Link href={`/permits/${permit.id}`} style={{ display: "inline-block", marginBottom: 12 }}>
        ← Back to the permit
      </Link>
      <h2 className="page-title">
        Edit permit <span className="mono">{permit.reference}</span>
      </h2>
      <p className="page-sub">Fields marked * are required. Documents are added or deleted on the permit page.</p>
      {error && (
        <div className="notice">
          The dropdown lists could not be loaded. Has <span className="mono">supabase/01-permits.sql</span> been run?
        </div>
      )}
      <PermitForm mode="edit" permitId={permit.id} initial={initial} options={lists} />
    </>
  );
}
