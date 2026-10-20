// Rules for the permit form, shared by the browser (instant messages) and the
// server (the real check). Pure functions, no database.
//
// Only OPEN / CLOSED / CANCELED will ever be stored. Overdue and Expiring Soon
// are worked out later by the site from "Valid to" (a later step).

export const STATUSES = ["OPEN", "CLOSED", "CANCELED"];
export const STATUS_LABELS = { OPEN: "Open", CLOSED: "Closed", CANCELED: "Canceled" };

// Checks the status part of the edit form. Returns { errors, clean }.
// A canceled permit needs a reason. Anything else clears the reason.
export function validateStatusInput(status, cancelReason) {
  const errors = {};
  const st = String(status ?? "").toUpperCase();
  if (!STATUSES.includes(st)) errors.status = "Choose Open, Closed or Canceled.";
  const reason = oneLine(cancelReason, 200);
  if (st === "CANCELED" && !reason) errors.cancelReason = "Give a reason for cancelling.";
  return { errors, clean: { status: st, cancelReason: st === "CANCELED" ? reason : "" } };
}

// What to store when a permit's status is set. The closed date is saved
// automatically: today in Oman time when it becomes CLOSED, and it is KEPT while
// the permit stays closed. Open and canceled permits have no closed date.
// prev: { status, closed_at }, today: "YYYY-MM-DD"
export function statusPatch(prev, nextStatus, cancelReason, today) {
  if (nextStatus === "CLOSED") {
    const keep = prev?.status === "CLOSED" && prev?.closed_at ? prev.closed_at : today;
    return { status: "CLOSED", closed_at: keep, cancel_reason: "" };
  }
  if (nextStatus === "CANCELED") return { status: "CANCELED", closed_at: null, cancel_reason: cancelReason };
  return { status: "OPEN", closed_at: null, cancel_reason: "" };
}

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

// Must be filled before a permit can be saved. Holder, issuer and area
// authority can be filled in later. Certificates: at least one (or NA).
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

// How long a permit may run, counted from "Valid from" (same numbers as the
// Excel calendar). Both the first and the last day count. This is a limit: a later "Valid to" is refused.
export function validityLimit(permitType) {
  const t = String(permitType || "").toUpperCase();
  if (t.includes("BLANKET")) return { days: 30, label: "COLD BLANKET permit" };
  if (t.includes("COLD")) return { days: 14, label: "COLD permit" };
  if (t.includes("HOT")) return { days: 7, label: "HOT permit" };
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

export function prettyDate(iso) {
  if (!isValidISODate(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// The latest allowed "Valid to" for this type and start date, or null.
export function latestValidTo(permitType, validFrom) {
  const limit = validityLimit(permitType);
  if (!limit || !isValidISODate(validFrom)) return null;
  // "Valid from" is day 1, so N days end on Valid from + (N - 1):
  // e.g. HOT (7 days) from 1 Aug ends on 7 Aug, COLD (14 days) from 1 Aug ends on 14 Aug.
  return { date: addDaysISO(validFrom, limit.days - 1), days: limit.days, label: limit.label };
}

// The message shown when "Valid to" is later than allowed (or "" if fine).
export function validToProblem(permitType, validFrom, validTo) {
  const latest = latestValidTo(permitType, validFrom);
  if (!latest || !isValidISODate(validTo)) return "";
  if (validTo > latest.date) {
    return `Too long: a ${latest.label} can run at most ${latest.days} days (latest ${prettyDate(latest.date)}).`;
  }
  return "";
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

export const isNA = (name) => String(name || "").trim().toUpperCase() === "NA";

// Key used for the error of one certificate's number: "certNumber:<name>".
export const certNumberKey = (name) => `certNumber:${name}`;

// Checks the form input and returns { errors, clean }.
// errors: { fieldName: "message" } (empty object = fine)
//
// certificates: a list of { name, number }. Every ticked certificate needs its
// own number; "NA" means none and its number is NA.
export function validatePermitInput(input) {
  const src = input && typeof input === "object" ? input : {};
  const errors = {};

  // ---- certificates ---------------------------------------------------
  const seen = new Set();
  const certificates = [];
  const rawCerts = Array.isArray(src.certificates) ? src.certificates : [];
  for (const c of rawCerts) {
    const name = oneLine(c?.name, 80);
    if (!name || seen.has(name.toUpperCase())) continue;
    seen.add(name.toUpperCase());
    certificates.push({ name, number: isNA(name) ? "NA" : oneLine(c?.number, 60) });
  }
  if (certificates.length === 0) {
    errors.certificates = "Tick at least one certificate, or NA if none.";
  } else if (certificates.some((c) => isNA(c.name)) && certificates.length > 1) {
    errors.certificates = "NA means no certificate. Untick NA, or untick the others.";
  } else {
    for (const c of certificates) {
      if (!isNA(c.name) && !c.number) {
        errors[certNumberKey(c.name)] = `Certificate number for ${c.name} is required.`;
      }
    }
  }

  const clean = {
    reference: normalizeReference(src.reference),
    area: oneLine(src.area, 40),
    location: oneLine(src.location, 200),
    permitType: oneLine(src.permitType, 60),
    jobDescription: multiLine(src.jobDescription, 1000),
    certificates,
    applicant: oneLine(src.applicant, 80),
    holder: oneLine(src.holder, 80),
    issuer: oneLine(src.issuer, 80),
    areaAuthority: oneLine(src.areaAuthority, 120),
    controller: oneLine(src.controller, 80),
    validFrom: String(src.validFrom ?? "").trim(),
    validTo: String(src.validTo ?? "").trim(),
  };

  for (const field of REQUIRED_FIELDS) {
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
    } else {
      const tooLong = validToProblem(clean.permitType, clean.validFrom, clean.validTo);
      if (tooLong) errors.validTo = tooLong;
    }
  }

  return { errors, clean };
}
