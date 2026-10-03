"use client";

import { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import DropZone from "../../components/DropZone";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_LABEL_LENGTH,
  displayFileName,
} from "../../../lib/attachments";
import {
  MAX_IMAGE_INPUT_BYTES,
  MAX_SIDE,
  QUALITY_DEFAULT,
  QUALITY_MAX,
  QUALITY_MIN,
  compressToJpeg,
  jpgName,
  kindOf,
} from "../../../lib/compressImage";

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

const MAX_MB = Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024);

const HEIC_MESSAGE =
  "This browser can't open this photo format (HEIC). On iPhone: Settings > Camera > Formats > Most Compatible, then take the photo again.";

// First check, on the file as chosen. PDFs must fit the limit as they are;
// photos are checked again after they are compressed.
function checkAttachment(f) {
  const kind = kindOf(f);
  if (!kind) return "Only PDF, JPEG or PNG files are allowed.";
  if (kind === "pdf") {
    if (f.size > MAX_ATTACHMENT_BYTES) {
      return `This PDF is ${formatSize(f.size)}. The limit is ${MAX_MB} MB. Compress it or choose a smaller file.`;
    }
    return null;
  }
  if (f.size > MAX_IMAGE_INPUT_BYTES) {
    return `This photo is ${formatSize(f.size)}, too big to process here. Choose a smaller one.`;
  }
  return null;
}

export default function AttachmentsPanel({ permitReference, initialAttachments, isAdmin }) {
  const [attachments, setAttachments] = useState(initialAttachments || []);
  const [label, setLabel] = useState("");
  const [file, setFile] = useState(null); // as chosen
  const [quality, setQuality] = useState(QUALITY_DEFAULT); // slider, % (moves live)
  const [appliedQuality, setAppliedQuality] = useState(QUALITY_DEFAULT); // used after the slider rests
  const [keepOriginal, setKeepOriginal] = useState(false); // JPEG only: upload untouched
  const [prepared, setPrepared] = useState(null); // { file, before, after, note } what will be uploaded
  const [preparing, setPreparing] = useState(false);
  const [prepError, setPrepError] = useState("");
  const [state, setState] = useState("idle"); // idle | uploading | error
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const kind = file ? kindOf(file) : null;
  const isPhoto = kind === "jpeg" || kind === "png" || kind === "heic";
  const mustConvert = kind === "png" || kind === "heic"; // the server only takes JPEG
  const useOriginal = keepOriginal && !mustConvert;

  // Wait until the slider stops moving before compressing again.
  useEffect(() => {
    const t = setTimeout(() => setAppliedQuality(quality), 350);
    return () => clearTimeout(t);
  }, [quality]);
  const tooBig = !!prepared && prepared.after > MAX_ATTACHMENT_BYTES;

  // Whenever the file or the quality slider changes, work out what will be
  // uploaded. Always starts from the original file, so quality never stacks.
  useEffect(() => {
    setPrepared(null);
    setPrepError("");
    if (!file) {
      setPreparing(false);
      return;
    }
    const k = kindOf(file);

    if (k === "pdf") {
      const pdf =
        file.type === "application/pdf"
          ? file
          : new File([file], file.name, { type: "application/pdf" });
      setPrepared({ file: pdf, before: file.size, after: file.size, note: "" });
      setPreparing(false);
      return;
    }

    if (k === "jpeg" && useOriginal) {
      const same = file.type === "image/jpeg" && /\.jpe?g$/i.test(file.name);
      const keep = same ? file : new File([file], jpgName(file.name), { type: "image/jpeg" });
      setPrepared({ file: keep, before: file.size, after: file.size, note: "" });
      setPreparing(false);
      return;
    }

    let cancelled = false;
    setPreparing(true);
    (async () => {
      try {
        const { blob, scaled } = await compressToJpeg(file, appliedQuality / 100);
        if (cancelled) return;
        // An already-small JPEG can get bigger when re-saved: keep it as it is.
        if (k === "jpeg" && !scaled && blob.size >= file.size) {
          const same = file.type === "image/jpeg" && /\.jpe?g$/i.test(file.name);
          const keep = same ? file : new File([file], jpgName(file.name), { type: "image/jpeg" });
          setPrepared({
            file: keep,
            before: file.size,
            after: file.size,
            note: "This photo is already small, so it is kept as it is.",
          });
        } else {
          const notes = [];
          if (k !== "jpeg") notes.push("Saved as JPEG on a white background.");
          if (scaled) notes.push(`Very large photo: reduced to ${MAX_SIDE} px on its longest side.`);
          setPrepared({
            file: new File([blob], jpgName(file.name), { type: "image/jpeg" }),
            before: file.size,
            after: blob.size,
            note: notes.join(" "),
          });
        }
      } catch (err) {
        if (cancelled) return;
        setPrepError(
          err?.message === "memory"
            ? "This device ran out of memory while preparing the photo. Choose a smaller photo or use another device."
            : k === "heic"
              ? HEIC_MESSAGE
              : "This image could not be opened. It may be damaged. Try another file."
        );
      } finally {
        if (!cancelled) setPreparing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, useOriginal, appliedQuality]);

  async function handleUpload(e) {
    e.preventDefault();
    const upFile = prepared?.file;
    if (!file || !upFile || preparing) return;

    const cleanLabel = label.trim();
    if (!cleanLabel) {
      setState("error");
      setMessage("Write what this document is (e.g. Physical Permit, JSA).");
      return;
    }
    if (!ALLOWED_CONTENT_TYPES[upFile.type]) {
      setState("error");
      setMessage("Only PDF, JPEG or PNG files are allowed.");
      return;
    }
    if (upFile.size > MAX_ATTACHMENT_BYTES) {
      setState("error");
      setMessage(`File must be under ${MAX_MB} MB, even after compression.`);
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
          fileName: upFile.name,
          contentType: upFile.type,
          sizeBytes: upFile.size,
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
      cloudinaryForm.append("file", upFile);

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
          fileName: upFile.name,
          storageKey: urlData.storageKey,
          contentType: upFile.type,
          sizeBytes: upFile.size,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || "Could not save attachment.");

      setAttachments((prev) => [createData.attachment, ...prev]);
      setFile(null);
      setLabel("");
      setState("idle");
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
          <div className="attach-field">
            <span className="attach-field-label">File (PDF, JPEG or PNG)</span>
            <DropZone
              file={file}
              onFile={(f) => {
                setFile(f);
                if (state === "error") setState("idle");
              }}
              accept=".pdf,.jpg,.jpeg,.png"
              alsoAllow=".heic,.heif"
              typeError="Only PDF, JPEG or PNG files are allowed."
              validate={checkAttachment}
              hint={`PDF, JPEG or PNG, up to ${MAX_MB} MB. Photos are compressed first.`}
              disabled={state === "uploading"}
            />

            {file && isPhoto && (
              <div className="cmp">
                <div className="cmp-head">
                  <span className="cmp-title">Photo size</span>
                  <span className="cmp-result" aria-live="polite">
                    {preparing
                      ? "Compressing…"
                      : prepared
                        ? prepared.before === prepared.after
                          ? formatSize(prepared.after)
                          : `${formatSize(prepared.before)} → ${formatSize(prepared.after)}`
                        : ""}
                  </span>
                </div>
                <div className="cmp-slider-row">
                  <label htmlFor="cmp-quality" className="cmp-slider-label">
                    Quality
                  </label>
                  <span className="cmp-slider-value">
                    {useOriginal ? "Original" : `${quality}%`}
                  </span>
                </div>
                <input
                  id="cmp-quality"
                  type="range"
                  className="cmp-slider"
                  min={QUALITY_MIN}
                  max={QUALITY_MAX}
                  step={1}
                  value={quality}
                  disabled={useOriginal || state === "uploading"}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  style={{
                    "--fill": `${((quality - QUALITY_MIN) / (QUALITY_MAX - QUALITY_MIN)) * 100}%`,
                  }}
                />
                <div className="cmp-slider-ends">
                  <span>Smaller file</span>
                  <span>Sharper print</span>
                </div>
                <label className={`cmp-check${mustConvert ? " cmp-check--off" : ""}`}>
                  <input
                    type="checkbox"
                    checked={useOriginal}
                    disabled={mustConvert || state === "uploading"}
                    onChange={(e) => setKeepOriginal(e.target.checked)}
                  />
                  <span>
                    Keep the original, no compression
                    {mustConvert ? " (not possible for this file type)" : ""}
                  </span>
                </label>
                {prepared?.note && <p className="cmp-note">{prepared.note}</p>}
                <p className="cmp-note">
                  Small print on scanned permits can look soft at lower quality.
                  Keep it at 80% or higher for those.
                </p>
                {prepError && (
                  <p className="error-text cmp-error" role="alert">
                    {prepError}
                  </p>
                )}
                {tooBig && (
                  <p className="error-text cmp-error" role="alert">
                    Even compressed this is {formatSize(prepared.after)}. The limit
                    is {MAX_MB} MB. Try Smallest or choose a smaller photo.
                  </p>
                )}
              </div>
            )}
          </div>
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
            disabled={!prepared || preparing || tooBig || !label.trim() || state === "uploading"}
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
