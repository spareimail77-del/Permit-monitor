"use client";

import { Fragment, useState } from "react";
import Icon from "../components/Icon";
import ChangeDetails from "./ChangeDetails";
import { formatSize, formatWhen } from "../../lib/format";

const PAGE = 12;

// "Current file" card + the upload log table. Rows come from the server page
// (newest first); uploading triggers router.refresh() so a new row shows up.
export default function UploadHistory({ rows, problem, limit, detailsMissing }) {
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState(null); // id of the row whose details are open

  const current = rows.find((r) => r.status === "uploaded");
  const visible = rows.slice(0, shown);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="panel" style={styles.currentCard}>
        <span style={styles.currentIcon}>
          <Icon name="clipboard" size={20} />
        </span>
        <div style={{ minWidth: 0 }}>
          <p style={styles.eyebrow}>File on the site now</p>
          {current ? (
            <>
              <p className="mono" style={styles.currentName} title={current.fileName}>
                {current.fileName}
              </p>
              <p style={styles.currentMeta}>
                Uploaded by <strong>{who(current)}</strong> · {formatWhen(current.at)} ·{" "}
                {formatSize(current.sizeBytes)}
                {current.permitCount != null && <> · {current.permitCount} permits</>}
              </p>
            </>
          ) : (
            <p style={styles.currentMeta}>
              {problem
                ? "The upload log is not available yet."
                : "Nothing has been logged yet. The next upload will appear here."}
            </p>
          )}
        </div>
      </div>

      <div>
        <div style={styles.headRow}>
          <h2 style={styles.title}>Upload history</h2>
          {rows.length > 0 && (
            <span style={styles.count}>
              {rows.length >= limit ? `Latest ${limit}` : `${rows.length} total`}
            </span>
          )}
        </div>

        {problem ? (
          <p className="notice">
            The upload log could not be read. Run <span className="mono">step35-profile-and-upload-log.sql</span>{" "}
            in Supabase (SQL Editor) once, then reload this page.
          </p>
        ) : rows.length === 0 ? (
          <div className="panel" style={{ padding: "18px 22px" }}>
            <p style={{ margin: 0, color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" }}>
              No uploads logged yet.
            </p>
          </div>
        ) : (
          <>
            {detailsMissing && (
              <p className="notice" style={{ marginBottom: 10 }}>
                To see added / updated / removed permits, run{" "}
                <span className="mono">step40-upload-log-changes.sql</span> in Supabase (SQL Editor) once.
              </p>
            )}
            <div className="table-scroll">
              <table className="permit-table upload-log-table">
                <thead>
                  <tr>
                    <th>When (Oman time)</th>
                    <th>Uploaded by</th>
                    <th>File</th>
                    <th style={{ textAlign: "right" }}>Size</th>
                    <th style={{ textAlign: "right" }}>Permits</th>
                    <th>Changes</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <Fragment key={r.id}>
                    <tr>
                      <td style={{ whiteSpace: "nowrap" }}>{formatWhen(r.at)}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.name || r.staffId || "Deleted account"}</div>
                        {r.name && r.staffId && (
                          <div className="mono" style={styles.sub}>
                            {r.staffId}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="mono upload-log-file" title={r.fileName}>
                          {r.fileName}
                        </div>
                        {r.note && <div style={styles.sub}>{r.note}</div>}
                      </td>
                      <td className="mono" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {formatSize(r.sizeBytes)}
                      </td>
                      <td className="mono" style={{ textAlign: "right" }}>
                        {r.permitCount ?? "–"}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {r.status === "uploaded" && r.addedCount != null ? (
                          <>
                            <span className="mono">
                              <span style={{ color: "var(--color-open)" }}>+{r.addedCount}</span>{" "}
                              <span style={{ color: "var(--color-brand-2)" }}>~{r.updatedCount ?? 0}</span>{" "}
                              <span style={{ color: "var(--color-expired)" }}>−{r.removedCount ?? 0}</span>
                            </span>
                            {r.addedCount + (r.updatedCount ?? 0) + (r.removedCount ?? 0) > 0 && (
                              <button
                                type="button"
                                className="archive-linkbtn"
                                style={{ marginLeft: 8 }}
                                onClick={() => setOpen(open === r.id ? null : r.id)}
                                aria-expanded={open === r.id}
                              >
                                {open === r.id ? "Hide" : "Details"}
                              </button>
                            )}
                          </>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td>
                        {r.status === "uploaded" ? (
                          <span
                            className="status-badge"
                            style={{ background: "var(--color-open-tint)", color: "var(--color-open)" }}
                          >
                            Uploaded
                          </span>
                        ) : (
                          <span
                            className="status-badge"
                            style={{ background: "var(--color-expired-tint)", color: "var(--color-expired)" }}
                          >
                            Rejected
                          </span>
                        )}
                      </td>
                    </tr>
                    {open === r.id && (
                      <tr>
                        <td colSpan={7} style={{ background: "var(--color-surface-2, transparent)" }}>
                          <ChangeDetails
                            counts={{
                              added: r.addedCount ?? 0,
                              updated: r.updatedCount ?? 0,
                              removed: r.removedCount ?? 0,
                            }}
                            changes={r.changes}
                          />
                          {r.archivedCount != null && (
                            <p style={{ ...styles.sub, marginTop: 10 }}>
                              Archive: {r.archivedCount} permit{r.archivedCount === 1 ? "" : "s"} copied or refreshed by this upload.
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {shown < rows.length && (
              <div style={{ marginTop: 12, textAlign: "center" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShown((n) => n + PAGE)}>
                  Show more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function who(r) {
  return r.name || r.staffId || "a deleted account";
}

const styles = {
  currentCard: {
    padding: "16px 20px",
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
  },
  currentIcon: {
    width: 40,
    height: 40,
    borderRadius: "var(--radius-sm)",
    background: "var(--color-brand-tint)",
    color: "var(--color-brand-2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  eyebrow: {
    margin: 0,
    fontFamily: "var(--font-mono), ui-monospace, monospace",
    fontSize: "var(--font-size-xs)",
    letterSpacing: "0.04em",
    color: "var(--color-brand-2)",
  },
  currentName: {
    margin: "4px 0 2px",
    fontSize: "var(--font-size-base)",
    fontWeight: 600,
    color: "var(--color-ink)",
    overflowWrap: "anywhere",
  },
  currentMeta: {
    margin: "2px 0 0",
    fontSize: "var(--font-size-sm)",
    color: "var(--color-ink-muted)",
  },
  headRow: { display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 },
  title: { margin: 0, fontSize: "var(--font-size-lg)", color: "var(--color-ink)" },
  count: { fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)" },
  sub: { fontSize: "var(--font-size-xs)", color: "var(--color-ink-muted)", marginTop: 2 },
};
