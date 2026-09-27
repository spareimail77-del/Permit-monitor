"use client";

import { useState } from "react";
import Icon from "../../components/Icon";
import { ATTACHMENT_KINDS, ALLOWED_CONTENT_TYPES, MAX_ATTACHMENT_BYTES } from "../../../lib/attachments";

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export default function AttachmentsPanel({ permitReference, initialAttachments, isAdmin }) {
  const [attachments, setAttachments] = useState(initialAttachments || []);
  const [kind, setKind] = useState(ATTACHMENT_KINDS[0].value);
  const [file, setFile] = useState(null);
  const [state, setState] = useState("idle"); // idle | uploading | error
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;

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
          kind,
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
          kind,
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

      {ATTACHMENT_KINDS.map(({ value, label }) => {
        const items = attachments.filter((a) => a.kind === value);
        if (items.length === 0) return null;
        return (
          <div key={value} style={styles.kindGroup}>
            <p style={styles.kindLabel}>{label}</p>
            <ul style={styles.list}>
              {items.map((a) => (
                <li key={a.id} style={styles.item}>
                  <a
                    href={`/api/attachments/${a.id}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.itemLink}
                  >
                    <Icon name="clipboard" size={15} />
                    {a.file_name}
                  </a>
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
          </div>
        );
      })}

      {isAdmin && (
        <form onSubmit={handleUpload} style={styles.form}>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            style={styles.select}
          >
            {ATTACHMENT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
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
            disabled={!file || state === "uploading"}
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
  kindGroup: { marginBottom: 14 },
  kindLabel: {
    fontSize: "var(--font-size-xs)",
    fontWeight: 700,
    color: "var(--color-ink-muted)",
    margin: "0 0 6px",
  },
  list: { listStyle: "none", margin: 0, padding: 0 },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 0",
    borderBottom: "1px solid var(--color-rule)",
    flexWrap: "wrap",
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
  select: {
    padding: "9px 12px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-rule)",
    background: "var(--color-surface-2)",
    color: "var(--color-ink)",
    fontFamily: "inherit",
    fontSize: "var(--font-size-sm)",
  },
  fileInput: { fontSize: "var(--font-size-sm)", color: "var(--color-ink)" },
};
