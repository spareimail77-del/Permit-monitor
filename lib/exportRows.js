import { computeStatus } from "./status";
import { isNA } from "./permitRules";

// One permit of the database -> the values the export puts in the Excel row.
// today = "YYYY-MM-DD" (Oman).

// The Excel log's own status words (its colour rules look for these):
// Open and Expiring soon -> OPEN, Overdue -> EXPIRED, Closed -> CLOSED, Canceled -> CANCELED.
export function excelStatusWord(key, stored) {
  if (key === "OPEN" || key === "EXPIRING") return "OPEN";
  if (key === "OVERDUE") return "EXPIRED";
  if (key === "CLOSED" || key === "CANCELED") return key;
  return String(stored ?? "").toUpperCase();
}

// Certificates and their numbers go in two columns, one per line, in the same
// order. No certificate (or only NA) -> NA in both, as in the log.
export function certificateColumns(certificates) {
  const list = (Array.isArray(certificates) ? certificates : [])
    .map((c) => ({ name: String(c?.name ?? "").trim(), number: String(c?.number ?? "").trim() }))
    .filter((c) => c.name && !isNA(c.name));
  if (list.length === 0) return { names: "NA", numbers: "NA" };
  return {
    names: list.map((c) => c.name).join("\n"),
    numbers: list.map((c) => c.number || "-").join("\n"),
  };
}

export function permitToExportRow(p, today) {
  const st = computeStatus(p, today);
  const certs = certificateColumns(p.certificates);
  return {
    reference: p.reference,
    area: p.area,
    location: p.location,
    permitType: p.permit_type,
    jobDescription: p.job_description,
    certificates: certs.names,
    certificateNo: certs.numbers,
    applicant: p.applicant,
    holder: p.holder,
    issuer: p.issuer,
    areaAuthority: p.area_authority,
    controller: p.controller,
    validFrom: p.valid_from,
    validTo: p.valid_to,
    statusText: excelStatusWord(st.key, p.status),
  };
}
