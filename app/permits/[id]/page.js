import Link from "next/link";
import AddFile from "../../components/AddFile";
import DeleteFileButton from "../../components/DeleteFileButton";
import PageHeader from "../../components/PageHeader";
import PermitActions from "../../components/PermitActions";
import PrintButton from "../../components/PrintButton";
import TrashActions from "../../components/TrashActions";
import StatusBadge from "../../components/StatusBadge";
import { omanDateTime } from "../../../lib/format";
import { todayOman } from "../../../lib/omanDate";
import { computeStatus, daysBetween } from "../../../lib/status";
import { getSupabase } from "../../../lib/db";
import { getViewer } from "../../../lib/viewer";
import { FILE_KINDS, formatBytes } from "../../../lib/fileRules";
import { isNA, prettyDate } from "../../../lib/permitRules";

export const dynamic = "force-dynamic";

const shortDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Muscat", day: "2-digit", month: "short", year: "numeric" }) : "";
const initials = (name) =>
  String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// One row of a card: grey label, value. Empty values stay visible as "Not assigned" / "—".
function Row({ label, children, empty }) {
  return (
    <div className="pd-row">
      <span className="pd-row__k">{label}</span>
      <span className={`pd-row__v${children ? "" : " pd-empty"}`}>{children || empty || "—"}</span>
    </div>
  );
}

function Person({ label, name }) {
  return (
    <Row label={label} empty="Not assigned">
      {name ? (
        <span className="pd-person">
          <span className="pd-av" aria-hidden="true">{initials(name)}</span>
          {name}
        </span>
      ) : null}
    </Row>
  );
}

// Where the permit is in its validity period: bar, today marker, text.
function validity(permit, status, today) {
  if (status.key === "CLOSED") return { pct: 100, mid: `Closed on ${prettyDate(permit.closed_at) || "—"}` };
  if (status.key === "CANCELED") return { pct: 100, mid: "Canceled" };
  const total = daysBetween(permit.valid_from, permit.valid_to);
  const elapsed = daysBetween(permit.valid_from, today);
  let pct = 0;
  if (total !== null && elapsed !== null) {
    pct = total <= 0 ? (elapsed >= 0 ? 100 : 0) : Math.max(0, Math.min(100, (elapsed / total) * 100));
  }
  const mid = elapsed !== null && elapsed < 0 ? `Starts in ${plural(-elapsed, "day")}` : status.detail;
  return { pct, mid };
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
      <PageHeader
        title="Permit not found"
        crumbs={[{ label: "Dashboard", href: "/" }, { label: "Permits", href: "/permits" }, { label: "Not found" }]}
        sub={
          <>
            There is no permit with this link. <Link href="/permits">Back to Permits</Link>
          </>
        }
      />
    );
  }

  const { data: files } = await supabase
    .from("permit_files")
    .select("id, kind, label, file_name, storage_path, size_bytes, created_at")
    .eq("permit_id", id)
    .order("id", { ascending: true });

  const today = todayOman();
  const certificates = Array.isArray(permit.certificates) ? permit.certificates : [];
  const certificateNames = certificates.filter((c) => !isNA(c.name)).map((c) => c.name);
  // A certificate copy whose certificate was later removed from the permit is still
  // listed (as a normal file), so it can be opened or deleted.
  const certSet = new Set(certificates.map((c) => c.name));
  const status = computeStatus(permit, today);
  const trashed = Boolean(permit.deleted_at);
  // A permit in the trash is read-only (only Root and HSE can see it at all).
  const canManage = Boolean(viewer?.canManagePermits) && !trashed;
  const v = validity(permit, status, today);

  // One list for the Attachments card: every file, plus a faint row for each
  // certificate that has no copy yet.
  const items = [];
  for (const f of files || []) {
    const cert = f.kind === "certificate" && certSet.has(f.label) ? certificates.find((c) => c.name === f.label) : null;
    items.push({
      key: `f${f.id}`,
      file: f,
      meta: [
        cert ? `Certificate · ${f.label}${cert.number && !isNA(f.label) ? `, no. ${cert.number}` : ""}` : `${FILE_KINDS[f.kind]}${f.label ? ` · ${f.label}` : ""}`,
        formatBytes(f.size_bytes),
        shortDate(f.created_at),
      ].filter(Boolean).join(" · "),
    });
  }
  for (const c of certificates) {
    if (isNA(c.name)) continue;
    if ((files || []).some((f) => f.kind === "certificate" && f.label === c.name)) continue;
    items.push({ key: `c${c.name}`, missing: true, name: c.name, meta: `Certificate${c.number ? ` · no. ${c.number}` : ""} · No copy attached` });
  }

  return (
    <div className="pd">
      <nav className="crumbs pd-noprint" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/">Dashboard</Link></li>
          <li><Link href="/permits">Permits</Link></li>
          <li><span aria-current="page">{permit.reference}</span></li>
        </ol>
      </nav>

      {trashed && (
        <div className="pd-noprint">
          <TrashActions permitId={permit.id} reference={permit.reference} canPurge={Boolean(viewer?.canPurgeTrash)} />
          <p className="pform-hint mb-4">
            Deleted by <span className="mono">{permit.deleted_by || "—"}</span> on {omanDateTime(permit.deleted_at)} (Oman time).
          </p>
        </div>
      )}
      {status.noValidTo && (
        <div className="notice">This open permit has no readable end date (Valid to), so its expiry cannot be worked out.</div>
      )}

      <section className={`pd-hero pd-hero--${status.key}`} aria-label="Permit summary">
        <div className="pd-hero__top">
          <div>
            <div className="pd-eyebrow">Permit no.</div>
            <div className="pd-hero__title">
              <h1 className="pd-ref mono">{permit.reference}</h1>
              <StatusBadge status={status} />
              {permit.permit_type && <span className="pd-type">{permit.permit_type}</span>}
              {trashed && <span className="pd-type pd-type--trash">In trash</span>}
            </div>
          </div>
          <div className="pd-hero__actions pd-noprint">
            <PrintButton />
            {canManage && (
              <Link href={`/permits/edit/${permit.id}`} className="btn btn-sm">
                Edit permit
              </Link>
            )}
          </div>
        </div>

        <div className="pd-bar" style={{ "--pct": `${v.pct}%` }} role="img" aria-label={`${Math.round(v.pct)} percent of the validity period has passed`}>
          <span className="pd-bar__fill" />
          <span className="pd-bar__dot" />
        </div>
        <div className="pd-bar-labels">
          <span>Valid from {prettyDate(permit.valid_from) || "—"}</span>
          <span className="pd-bar-labels__mid">{v.mid}</span>
          <span>Valid to {prettyDate(permit.valid_to) || "—"}</span>
        </div>
      </section>

      <div className="pd-grid">
        <section className="pd-card">
          <div className="pd-card__head"><h2>Permit details</h2></div>
          <Row label="Area">{permit.area}</Row>
          <Row label="Location">{permit.location}</Row>
          <Row label="Permit type">{permit.permit_type}</Row>
          <Row label="Job description">{permit.job_description}</Row>
          {permit.status === "CLOSED" && <Row label="Closed on">{prettyDate(permit.closed_at)}</Row>}
          {permit.status === "CANCELED" && <Row label="Cancel reason">{permit.cancel_reason}</Row>}
        </section>

        <section className="pd-card">
          <div className="pd-card__head"><h2>Personnel</h2></div>
          <Person label="Applicant" name={permit.applicant} />
          <Person label="Permit holder" name={permit.holder} />
          <Person label="Controller" name={permit.controller} />
          <Person label="Authorized issuer" name={permit.issuer} />
          <Person label="Area authority" name={permit.area_authority} />
        </section>
      </div>

      <section className="pd-card">
        <div className="pd-card__head">
          <h2>Attachments</h2>
          <span className="pd-count">{plural((files || []).length, "file")}</span>
        </div>
        {items.length === 0 ? (
          <p className="pd-none">No documents attached yet.</p>
        ) : (
          items.map((it) =>
            it.missing ? (
              <div key={it.key} className="pd-file pd-file--missing">
                <span className="pd-ftype pd-ftype--none" aria-hidden="true">CERT</span>
                <span className="pd-file__main">
                  <span className="pd-file__name">{it.name}</span>
                  <span className="pd-file__meta">{it.meta}</span>
                </span>
              </div>
            ) : (
              <div key={it.key} className="pd-file">
                <span className={`pd-ftype${/\.pdf$/i.test(it.file.file_name) ? "" : " pd-ftype--img"}`} aria-hidden="true">
                  {/\.pdf$/i.test(it.file.file_name) ? "PDF" : "IMG"}
                </span>
                <span className="pd-file__main">
                  <span className="pd-file__name">{it.file.file_name}</span>
                  <span className="pd-file__meta">{it.meta}</span>
                </span>
                <span className="pd-file__actions pd-noprint">
                  {/* Each link makes a fresh 5-minute private link when it is clicked. */}
                  <a className="btn btn-sm" href={`/api/files/${it.file.id}/view`} target="_blank" rel="noreferrer">
                    View
                  </a>
                  {canManage && <DeleteFileButton permitId={permit.id} fileId={it.file.id} fileName={it.file.file_name} />}
                </span>
              </div>
            )
          )
        )}
        {canManage && (
          <div className="pd-add pd-noprint">
            <h3 className="pd-add__title">Add a document</h3>
            <AddFile permitId={permit.id} certificateNames={certificateNames} />
          </div>
        )}
      </section>

      {canManage && <PermitActions permitId={permit.id} reference={permit.reference} status={permit.status} />}
    </div>
  );
}
