import Link from "next/link";
import { createClient } from "../../lib/supabase/server";
import { formatSize, formatWhen } from "../../lib/format";

// Root / HSE only: the person's own last uploads. Async server component.
export default async function RecentUploads({ userId }) {
  let rows = [];
  let problem = false;
  try {
    const { data, error } = await createClient()
      .from("upload_log")
      .select("id, file_name, size_bytes, permit_count, status, created_at")
      .eq("uploaded_by", userId)
      .order("created_at", { ascending: false })
      .limit(3);
    if (error) problem = true;
    rows = data || [];
  } catch (err) {
    problem = true;
  }

  return (
    <div className="panel pf-card">
      <div className="pf-card__head">
        <h3 className="pf-card__title">My recent uploads</h3>
        <Link prefetch={false} href="/upload" className="pf-link">
          Upload page →
        </Link>
      </div>
      {problem ? (
        <p className="pf-muted">The upload log is not available yet.</p>
      ) : rows.length === 0 ? (
        <p className="pf-muted">You have not uploaded a file yet.</p>
      ) : (
        <ul className="pf-uploads">
          {rows.map((r) => (
            <li key={r.id}>
              <span className="mono pf-uploads__file" title={r.file_name}>
                {r.file_name}
              </span>
              <span className="pf-uploads__meta">
                {formatWhen(r.created_at)} · {formatSize(r.size_bytes)}
                {r.permit_count != null && <> · {r.permit_count} permits</>}
                {r.status === "rejected" && <span className="pf-uploads__bad"> · rejected</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
