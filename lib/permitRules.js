// Rules for the permit form, shared by the browser (instant messages) and the
// server (the real check). Pure functions, no database.
//
// Only OPEN / CLOSED / CANCELED will ever be stored. Overdue and Expiring Soon
// are worked out later by the site from "Valid to" (a later step).

export const STATUSES = ["OPEN", "CLOSED", "CANCELED"];

// The dropdown lists of the form (same lists as the Excel DropdownRAW sheet).
export const OPTION_LISTS = [
  { key: "area", label: "Area" },
  { key: "permit_type", label: "Type of permit" },
  { key: "certificate", label: "Associated certificates" },
  { key: "applicant", label: "Permit applicant" },
  { key: "holder", label: "Permit holder" },
  { key: "issuer", label: "Authorized permit issuer" },
  { key: "controller", label: "Permit controller" },
];

export const FIELD_LABELS = {
  reference: "Permit number",
  area: "Area",
  location: "Location",
  permitType: "Type of permit",
  jobDescription: "Job description",
  applicant: "Permit applicant",
  controller: "Permit controller",
  validFrom: "Valid from",
  validTo: "Valid to",
};

// Must be filled before a permit can be saved. Holder, issuer, certificates
// and area authority can be filled in later (people are notified in a later step).
export const REQUIRED_FIELDS = [
  "reference",
  "area",
  "location",
  "permitType",
  "jobDescription",
  "applicant",
  "controller",
  "validFrom",
  "validTo",
];

// Same suggestion as the Excel calendar: Blanket 30 days, COLD 14, HOT 7.
// It is only a suggestion; the person can pick any date from "Valid from".
export function recommendedDays(permitType) {
  const t = String(permitType || "").toUpperCase();
  if (t.includes("BLANKET")) return { days: 30, label: "COLD Blanket (30 days)" };
  if (t.includes("COLD")) return { days: 14, label: "COLD permit (14 days)" };
  if (t.includes("HOT")) return { days: 7, label: "HOT permit (7 days)" };
  return null;
}

export function isValidISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDaysISO(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

// One line of text: single spaces, no control characters.
export function oneLine(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

// Several lines allowed (job description), but tidy.
function multiLine(value, max) {
  return String(value ?? "")
    .replace(/\r\n|\r/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, max);
}

export function normalizeReference(value) {
  return oneLine(value, 40);
}

// Checks the form input and returns { errors, clean }.
// errors: { fieldName: "message" } (empty object = fine)
// mode "create" | "edit". In edit mode the permit number is not changed here
// (attachments are filed under it), so it is not checked.
export function validatePermitInput(input, { mode = "create" } = {}) {
  const src = input && typeof input === "object" ? input : {};
  const errors = {};

  const certList = Array.isArray(src.certificates)
    ? src.certificates
    : String(src.certificates ?? "").split(/\r\n|\r|\n/);
  const certificates = [
    ...new Set(certList.map((c) => oneLine(c, 80)).filter(Boolean)),
  ].join("\n");

  const clean = {
    reference: normalizeReference(src.reference),
    area: oneLine(src.area, 40),
    location: oneLine(src.location, 200),
    permitType: oneLine(src.permitType, 60),
    jobDescription: multiLine(src.jobDescription, 1000),
    certificates,
    certificateNo: oneLine(src.certificateNo, 200),
    applicant: oneLine(src.applicant, 80),
    holder: oneLine(src.holder, 80),
    issuer: oneLine(src.issuer, 80),
    areaAuthority: oneLine(src.areaAuthority, 120),
    controller: oneLine(src.controller, 80),
    validFrom: String(src.validFrom ?? "").trim(),
    validTo: String(src.validTo ?? "").trim(),
    status: String(src.status ?? "OPEN").toUpperCase(),
    cancelReason: oneLine(src.cancelReason, 300),
  };

  for (const field of REQUIRED_FIELDS) {
    if (field === "reference" && mode === "edit") continue;
    if (!clean[field]) errors[field] = `${FIELD_LABELS[field]} is required.`;
  }

  if (clean.validFrom && !isValidISODate(clean.validFrom)) {
    errors.validFrom = "Valid from is not a real date.";
  }
  if (clean.validTo && !isValidISODate(clean.validTo)) {
    errors.validTo = "Valid to is not a real date.";
  }
  if (!errors.validFrom && !errors.validTo && clean.validFrom && clean.validTo) {
    if (clean.validTo < clean.validFrom) {
      errors.validTo = "Valid to cannot be before Valid from.";
    }
  }
  if (!STATUSES.includes(clean.status)) {
    errors.status = "Status must be Open, Closed or Canceled.";
  }

  return { errors, clean };
}
