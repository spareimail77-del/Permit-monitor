"use client";

import { useState } from "react";
import Icon from "../../components/Icon";
import { ALLOWED_CONTENT_TYPES, MAX_ATTACHMENT_BYTES, MAX_LABEL_LENGTH } from "../../../lib/attachments";

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export default function AttachmentsPanel({ permitReference, initialAttachments, isAdmin }) {
  const [attachments, setAttachments] = useState(initialAttachments || []);
  const [label, setLabel] = useState("");
  const [file, setFile] = useState(null);
  const [state, setState] = useState("idle"); // idle | uploading | error
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;

    const cleanLabel = label.trim();
    if (!cleanLabel) {
      setState("error");
      setMessage("Write what this document is (e.g. Physical Permit, JSA).");
      return;
    }
    if (!ALLOWED_CONTENT_TYPES[file.type]) {
      setState("error");
      setMessage("Only PDF or JPEG files are allowed.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setState("error");
      setMessage(`File must be under ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB.`);
      return;
    }

    setState("uploading");
    setMessage("");

    try {
      const urlRes = await fetch("/api/admin/attachments/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permitReference,
          label: cleanLabel,
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error || "Could not start upload.");

      // Plain multipart/form-data POST, straight to Cloudinary. No
      // custom headers, so the browser never even sends a CORS
      // preflight for this one — unlike Backblaze, which rejected the
      // preflight outright on every path we tried.
      const cloudinaryForm = new FormData();
      Object.entries(urlData.params).forEach(([key, value]) => {
        cloudinaryForm.append(key, value);
      });
      cloudinaryForm.append("file", file);

      const postRes = await fetch(urlData.uploadUrl, {
        method: "POST",
        body: cloudinaryForm,
      });
      if (!postRes.ok) throw new Error("Upload to storage failed.");

      const createRes = await fetch("/api/admin/attachments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permitReference,
          label: cleanLabel,
          fileName: file.name,
          storageKey: urlData.storageKey,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || "Could not save attachment.");

      setAttachments((prev) => [createData.attachment, ...prev]);
      setFile(null);
      setLabel("");
      setState("idle");
      const input = document.getElementById("attachment-file-input");
      if (input) input.value = "";
    } catch (err) {
      setState("error");
      setMessage(err.message || "Upload failed.");
    }
  }

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/attachments/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete.");
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setMessage(err.message || "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="panel" style={styles.card}>
      <h3 style={styles.groupTitle}>Attachments</h3>

      {attachments.length === 0 && (
        <p style={styles.emptyText}>No files attached yet.</p>
      )}

      {attachments.length > 0 && (
        <ul style={styles.list}>
          {attachments.map((a) => (
            <li key={a.id} style={styles.item}>
              <div style={styles.itemMain}>
                <p style={styles.itemLabel}>{a.label}</p>
                <a
                  href={`/api/attachments/${a.id}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.itemLink}
                >
                  <Icon name="clipboard" size={15} />
                  {a.file_name}
                </a>
              </div>
              <span style={styles.itemMeta}>{formatSize(a.size_bytes)}</span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="btn btn-ghost"
                  style={styles.deleteBtn}
                >
                  <Icon name="xCircle" size={14} />
                  {deletingId === a.id ? "Removing…" : "Remove"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <form onSubmit={handleUpload} style={styles.form}>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="What is this document? (e.g. Physical Permit, JSA)"
            maxLength={MAX_LABEL_LENGTH}
            style={styles.labelInput}
          />
          <input
            id="attachment-file-input"
            type="file"
            accept=".pdf,.jpg,.jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={styles.fileInput}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!file || !label.trim() || state === "uploading"}
          >
            {state === "uploading" ? "Uploading…" : "Add attachment"}
          </button>
        </form>
      )}

      {state === "error" && <p className="error-text">{message}</p>}
    </div>
  );
}

const styles = {
  card: { padding: "20px 24px", marginBottom: 16 },
  groupTitle: {
    fontSize: "var(--font-size-sm)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    color: "var(--color-ink-muted)",
    marginTop: 0,
    marginBottom: 16,
  },
  emptyText: { color: "var(--color-ink-muted)", fontSize: "var(--font-size-sm)" },
  list: { listStyle: "none", margin: 0, padding: 0 },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 0",
    borderBottom: "1px solid var(--color-rule)",
    flexWrap: "wrap",
  },
  itemMain: { display: "flex", flexDirection: "column", gap: 2 },
  itemLabel: {
    margin: 0,
    fontSize: "var(--font-size-xs)",
    fontWeight: 700,
    color: "var(--color-ink-muted)",
  },
  itemLink: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "var(--color-brand-2)",
    fontWeight: 600,
    fontSize: "var(--font-size-sm)",
    textDecoration: "none",
  },
  itemMeta: {
    fontSize: "var(--font-size-xs)",
    color: "var(--color-ink-muted)",
    marginLeft: "auto",
  },
  deleteBtn: { padding: "4px 10px", fontSize: "var(--font-size-xs)" },
  form: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    marginTop: 16,
    flexWrap: "wrap",
  },
  labelInput: {
    padding: "9px 12px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-rule)",
    background: "var(--color-surface-2)",
    color: "var(--color-ink)",
    fontFamily: "inherit",
    fontSize: "var(--font-size-sm)",
    flex: "1 1 240px",
    minWidth: 200,
  },
  fileInput: { fontSize: "var(--font-size-sm)", color: "var(--color-ink)" },
};
