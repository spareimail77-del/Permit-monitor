// Rules for files attached to a permit. Shared by the browser (instant
// message when a file is picked) and the server (the real check).

export const FILE_BUCKET = "permit-files";
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_FILE_TYPES = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG photo",
  "image/png": "PNG image",
};

// What kind of document it is.
export const FILE_KINDS = {
  permit_copy: "Permit copy",
  jsa: "JSA",
  certificate: "Certificate copy",
  other: "Other document",
};

export function fileProblem(file) {
  if (!file) return "Choose a file.";
  if (!ALLOWED_FILE_TYPES[file.type]) return `${file.name}: only PDF, JPEG or PNG files are allowed.`;
  if (file.size > MAX_FILE_BYTES) return `${file.name}: larger than 10 MB. Make it smaller first.`;
  if (file.size === 0) return `${file.name}: the file is empty.`;
  return null;
}

// Safe text for a storage path.
export function safeFileName(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(-80) || "file";
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
