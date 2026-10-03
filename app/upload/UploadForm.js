"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../components/Icon";
import DropZone from "../components/DropZone";
import ChangeDetails from "./ChangeDetails";
import { formatSize, formatWhen } from "../../lib/format";

// The file goes through the site's server on Vercel's free plan, which
// refuses request bodies over about 4.5 MB. Catch that here with a clear
// message instead of a vague failure after waiting.
const MAX_EXCEL_BYTES = 4.4 * 1024 * 1024;

function checkExcel(f) {
  if (f.size > MAX_EXCEL_BYTES) {
    return `This file is ${formatSize(f.size)}. The site accepts Excel files up to about 4.4 MB. Save a smaller copy and try again.`;
  }
  return null;
}

export default function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [state, setState] = useState("idle"); // idle | uploading | done | error
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;

    setState("uploading");
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Upload failed.");
        router.refresh(); // rejected files are logged too
        return;
      }

      setState("done");
      setResult(data);
      router.refresh(); // shows the new row in the upload history below
    } catch (err) {
      setState("error");
      setMessage("Upload failed. Check your connection and try again.");
    }
  }

  return (
    <div className="panel" style={styles.card}>
      <div style={styles.cardHead}>
        <p style={styles.badge}>
          <Icon name="checkCircle" size={14} /> Signed in as admin
        </p>
      </div>

      <p style={styles.cardText}>
        Upload the latest <span className="mono">.xlsm</span> permit log.
        This replaces the file the dashboard reads from. Your local
        Excel file and its macros are never touched — this only copies
        the file to storage.
      </p>

      <form onSubmit={handleUpload} style={styles.form}>
        <DropZone
          file={file}
          onFile={(f) => {
            setFile(f);
            if (state === "error") setState("idle");
          }}
          accept=".xlsm,.xlsx"
          typeError="Please choose a .xlsm or .xlsx file."
          validate={checkExcel}
          hint=".xlsm or .xlsx, up to about 4.4 MB"
          disabled={state === "uploading"}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!file || state === "uploading"}
        >
          {state === "uploading" ? "Uploading…" : "Upload"}
        </button>
      </form>

      {state === "error" && <p className="error-text">{message}</p>}

      {state === "done" && result && (
        <div style={styles.resultBox}>
          <p style={styles.resultLine}>
            <strong>Uploaded:</strong>{" "}
            <span className="mono">{result.originalName}</span>
          </p>
          <p style={styles.resultLine}>
            <strong>Size:</strong> {formatSize(result.size)}
          </p>
          <p style={styles.resultLine}>
            <strong>Stored at:</strong>{" "}
            {formatWhen(result.uploadedAt)} (Oman time)
          </p>
          {result.permitCount != null && (
            <p style={styles.resultLine}>
              <strong>Permits in file:</strong> {result.permitCount}
            </p>
          )}
          {result.archiveSummary && (
            <p style={styles.resultLine}>
              <strong>Archive:</strong> {result.archiveSummary.added} new copied,{" "}
              {result.archiveSummary.refreshed} refreshed
              {result.archiveSummary.left > 0 &&
                `, ${result.archiveSummary.left} no longer in the log`}
              {result.archiveSummary.returned > 0 &&
                `, ${result.archiveSummary.returned} back in the log`}
            </p>
          )}
          {result.diff ? (
            <div style={styles.resultLine}>
              <strong>Compared with the previous file:</strong> {result.diff.addedCount} added,{" "}
              {result.diff.updatedCount} updated, {result.diff.removedCount} removed
              {result.diff.addedCount + result.diff.updatedCount + result.diff.removedCount > 0 && (
                <details style={{ marginTop: 6 }}>
                  <summary style={{ cursor: "pointer" }}>Show which permits</summary>
                  <ChangeDetails
                    counts={{
                      added: result.diff.addedCount,
                      updated: result.diff.updatedCount,
                      removed: result.diff.removedCount,
                    }}
                    changes={result.diff.changes}
                  />
                </details>
              )}
            </div>
          ) : (
            <p style={styles.resultLine}>
              <strong>Compared with the previous file:</strong> not available for this upload
            </p>
          )}
          {result.archiveWarning && (
            <p className="error-text" style={styles.resultLine}>
              {result.archiveWarning}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  card: { padding: "24px 28px" },
  cardHead: {
    display: "flex",
    alignItems: "center",
    marginBottom: 14,
    flexWrap: "wrap",
    gap: 10,
  },
  badge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    margin: 0,
    fontSize: "var(--font-size-xs)",
    fontWeight: 600,
    color: "var(--color-open)",
  },
  cardText: { color: "var(--color-ink-muted)", marginTop: 0 },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    alignItems: "flex-start",
    marginTop: 20,
  },
  resultBox: {
    marginTop: 20,
    padding: "16px 18px",
    background: "var(--color-open-tint)",
    border: "1px solid var(--color-open)",
    borderRadius: "var(--radius-sm)",
  },
  resultLine: { margin: "4px 0", fontSize: "var(--font-size-sm)" },
};
