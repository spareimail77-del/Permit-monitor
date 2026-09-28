"use client";

import { useState } from "react";
import Icon from "../../components/Icon";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_LABEL_LENGTH,
  displayFileName,
} from "../../../lib/attachments";

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
  const [downloadingId, setDownloadingId] = useState(null);

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

  // Saves the file under "Permit number - Document name.ext" by
  // fetching it as a blob and letting the browser save that blob with
  // our own name. Goes straight from Cloudinary to the device (nothing
  // passes through Vercel). If the browser can't read the file this
  // way (e.g. a CORS restriction), fall back to the normal link so the
  // person still gets their file, just under Cloudinary's default name.
  async function handleDownload(a) {
    const viewUrl = `/api/attachments/${a.id}/view`;
    setDownloadingId(a.id);
    try {
      const res = await fetch(viewUrl);
      if (!res.ok) throw new Error("Download failed.");
      const blob = await res.blob();
      const name = displayFileName(permitReference, a.label, a.content_type)
        .replace(/[\\/:*?"<>|]/g, "-");
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (err) {
      console.error("Renamed download failed, using plain link:", err);
      window.location.href = viewUrl;
    } finally {
      setDownloadingId(null);
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
        <ul className="attach-list">
          {attachments.map((a) => (
            <li key={a.id} className="attach-item">
              <a
                href={`/api/attachments/${a.id}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="attach-link"
              >
                <Icon name="clipboard" size={18} />
                <span className="attach-text">
                  <span className="attach-name">
                    {displayFileName(permitReference, a.label, a.content_type)}
                  </span>
                  <span className="attach-meta">
                    {formatSize(a.size_bytes)}
                    {a.file_name ? ` · ${a.file_name}` : ""}
                  </span>
                </span>
              </a>
              <button
                type="button"
                onClick={() => handleDownload(a)}
                disabled={downloadingId === a.id}
                className="btn btn-ghost attach-remove"
              >
                {downloadingId === a.id ? "Saving…" : "Download"}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="btn btn-ghost attach-remove"
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
        <form onSubmit={handleUpload} className="attach-form">
          <label className="attach-field">
            <span className="attach-field-label">Document name</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Physical Permit, JSA, Certificate"
              maxLength={MAX_LABEL_LENGTH}
              className="attach-input"
            />
          </label>
          <label className="attach-field">
            <span className="attach-field-label">File (PDF or JPEG)</span>
            <input
              id="attachment-file-input"
              type="file"
              accept=".pdf,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="attach-file"
            />
          </label>
          {label.trim() && (
            <p className="attach-preview">
              Will be saved as{" "}
              <strong>
                {permitReference} - {label.trim()}
              </strong>
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary attach-submit"
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
};
