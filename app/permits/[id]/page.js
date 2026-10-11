import Link from "next/link";
import AddFile from "../../components/AddFile";
import DeleteFileButton from "../../components/DeleteFileButton";
import PermitActions from "../../components/PermitActions";
import { getSupabase } from "../../../lib/db";
import { getViewer } from "../../../lib/viewer";
import { FILE_KINDS, formatBytes } from "../../../lib/fileRules";
import { isNA, prettyDate } from "../../../lib/permitRules";

export const dynamic = "force-dynamic";

function Detail({ label, value }) {
  return (
    <div>
      <div className="detail-label">{label}</div>
      <p className="detail-value">{value || "—"}</p>
    </div>
  );
}

export default async function PermitPage({ params }) {
  const id = Number(params.id);
  const viewer = await getViewer();
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
          There is no permit with this link. <Link href="/permits">Back to the permit list</Link>
        </p>
      </>
    );
  }

  const { data: files } = await supabase
    .from("permit_files")
    .select("id, kind, label, file_name, storage_path, size_bytes, created_at")
    .eq("permit_id", id)
    .order("id", { ascending: true });

  const certificates = Array.isArray(permit.certificates) ? permit.certificates : [];
  const certificateNames = certificates.filter((c) => !isNA(c.name)).map((c) => c.name);
  const fileFor = (c) => (files || []).filter((f) => f.kind === "certificate" && f.label === c.name);
  // A certificate copy whose certificate was later removed from the permit is
  // listed under Documents, so it can still be opened or deleted.
  const certSet = new Set(certificates.map((c) => c.name));
  const generalFiles = (files || []).filter((f) => f.kind !== "certificate" || !certSet.has(f.label));
  const canManage = Boolean(viewer?.canManagePermits);

  // Each link makes a fresh 5-minute private link when it is clicked.
  const FileLink = ({ f }) => (
    <a href={`/api/files/${f.id}/view`} target="_blank" rel="noreferrer">
      {f.file_name}
    </a>
  );

  return (
    <>
      <Link href="/permits" style={{ display: "inline-block", marginBottom: 12 }}>
        ← Back to the permit list
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 className="page-title" style={{ margin: 0 }}>
          Permit <span className="mono">{permit.reference}</span>
        </h2>
        <span className={`badge badge--${permit.status}`}>{permit.status}</span>
        {canManage && (
          <Link href={`/permits/edit/${permit.id}`} className="btn btn-sm">
            Edit permit
          </Link>
        )}
      </div>

      <div className="panel pform-card" style={{ marginBottom: 16 }}>
        <h3 className="pform-title">Details</h3>
        <div className="detail-grid">
          <Detail label="Area" value={permit.area} />
          <Detail label="Location" value={permit.location} />
          <Detail label="Type of permit" value={permit.permit_type} />
          <Detail label="Valid from" value={prettyDate(permit.valid_from)} />
          <Detail label="Valid to" value={prettyDate(permit.valid_to)} />
          <Detail label="Applicant" value={permit.applicant} />
          <Detail label="Holder" value={permit.holder} />
          <Detail label="Authorized issuer" value={permit.issuer} />
          <Detail label="Area authority" value={permit.area_authority} />
          <Detail label="Controller" value={permit.controller} />
          {permit.status === "CLOSED" && <Detail label="Closed on" value={prettyDate(permit.closed_at)} />}
          {permit.status === "CANCELED" && <Detail label="Cancel reason" value={permit.cancel_reason} />}
        </div>
        <div style={{ marginTop: 14 }}>
          <Detail label="Job description" value={permit.job_description} />
        </div>
      </div>

      <div className="panel pform-card" style={{ marginBottom: 16 }}>
        <h3 className="pform-title">Certificates</h3>
        {certificates.length === 0 ? (
          <p className="pform-hint">None recorded.</p>
        ) : (
          <ul className="file-list">
            {certificates.map((c) => (
              <li key={c.name}>
                <span>
                  <strong>{c.name}</strong> — <span className="mono">{c.number}</span>
                </span>
                <span>
                  {fileFor(c).map((f) => (
                    <span key={f.id} style={{ marginLeft: 12 }}>
                      <FileLink f={f} /> <span className="pform-hint">{formatBytes(f.size_bytes)}</span>
                      {canManage && <DeleteFileButton permitId={permit.id} fileId={f.id} fileName={f.file_name} />}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel pform-card" style={{ marginBottom: 16 }}>
        <h3 className="pform-title">Documents</h3>
        {generalFiles.length === 0 ? (
          <p className="pform-hint">No documents yet.</p>
        ) : (
          <ul className="file-list">
            {generalFiles.map((f) => (
              <li key={f.id}>
                <span>
                  <strong>{FILE_KINDS[f.kind]}</strong>
                  {f.label ? ` — ${f.label}` : ""}: <FileLink f={f} />
                </span>
                <span>
                  <span className="pform-hint">{formatBytes(f.size_bytes)}</span>
                  {canManage && <DeleteFileButton permitId={permit.id} fileId={f.id} fileName={f.file_name} />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canManage && <PermitActions permitId={permit.id} reference={permit.reference} status={permit.status} />}

      {canManage && (
        <div className="panel pform-card">
          <h3 className="pform-title">Add a document</h3>
          <AddFile permitId={permit.id} certificateNames={certificateNames} />
        </div>
      )}
    </>
  );
}
