// Document name is now free text the admin types at upload time
// (e.g. "Physical Permit", "JSA", "Risk Assessment") rather than a
// fixed dropdown — MAX_LABEL_LENGTH just guards against someone
// pasting something absurd in there.
export const MAX_LABEL_LENGTH = 60;

export function sanitizeLabel(value) {
  return String(value ?? "").trim().slice(0, MAX_LABEL_LENGTH);
}

// content type -> file extension used when building the storage key.
export const ALLOWED_CONTENT_TYPES = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
};

// Cloudinary's free plan hard-caps both image and raw (PDF) uploads
// at 10MB per file — this isn't a safety margin, it's their ceiling.
// Compress scans down under this before uploading.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function sanitizeForKey(str) {
  return String(str).trim().replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Friendly, identifiable name shown on screen for an attachment:
// "<permit number> - <what the admin typed>.<ext>", e.g.
// "PTW-1234 - JSA.pdf". (Cloudinary's private links can't carry a
// custom download name, so this is display-only.)
export function displayFileName(permitReference, label, contentType) {
  const ext = ALLOWED_CONTENT_TYPES[contentType] || "";
  return `${permitReference} - ${label}${ext ? "." + ext : ""}`;
}
