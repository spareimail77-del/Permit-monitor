export const ATTACHMENT_KINDS = [
  { value: "physical_permit", label: "Physical Permit (scanned)" },
  { value: "jsa", label: "JSA" },
];

export const ATTACHMENT_KIND_VALUES = ATTACHMENT_KINDS.map((k) => k.value);

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
