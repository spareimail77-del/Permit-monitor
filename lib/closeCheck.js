// "Is this permit ready to close?"  One place that every closing path asks:
//   - the list (row menu and bulk Close), the permit page, and the edit form.
//
// Two reminders, both only warnings (the person can always "Close anyway"):
//   1. Details that may be left empty when a permit is saved: holder, issuer, area
//      authority. To check more fields, add them to CLOSE_CHECK_FIELDS.
//      "NA" counts as filled (it is how the form says "not applicable").
//   2. Certificate copies. Only permits with at least one real certificate (not NA) are
//      checked. A certificate counts as "attached" when a file with that certificate's
//      name is on the permit, the same rule the permit page uses for "No copy attached".

import { isNA } from "./permitRules";

export const CLOSE_CHECK_FIELDS = [
  { key: "holder", label: "Permit holder", read: (p) => p.holder },
  { key: "issuer", label: "Authorized permit issuer", read: (p) => p.issuer },
  { key: "areaAuthority", label: "Area authority", read: (p) => p.area_authority ?? p.areaAuthority },
];

// Empty details -> [{ key: "issuer", label: "Authorized permit issuer" }, ...]  ([] = complete).
// Accepts a database row (area_authority) or the form values (areaAuthority).
export function missingForClose(permit) {
  const p = permit && typeof permit === "object" ? permit : {};
  return CLOSE_CHECK_FIELDS.filter((f) => String(f.read(p) ?? "").trim() === "").map(({ key, label }) => ({ key, label }));
}

// Certificates without an attached copy -> [{ name, number }].
// certificates: the permit's [{ name, number }] list. attachedNames: names that have a copy.
// attachedNames not a list = "could not be read": nothing is reported (no false alarms).
export function missingCertificates(certificates, attachedNames) {
  if (!Array.isArray(attachedNames)) return [];
  const have = new Set(attachedNames.map((n) => String(n ?? "")));
  return (Array.isArray(certificates) ? certificates : [])
    .filter((c) => c && c.name && !isNA(c.name) && !have.has(c.name))
    .map((c) => ({ name: c.name, number: String(c.number ?? "").trim() }));
}

// Both checks for one permit: { missing: [fields], certs: [certificates] }.
export function checkForClose(permit, attachedNames) {
  const p = permit && typeof permit === "object" ? permit : {};
  return { missing: missingForClose(p), certs: missingCertificates(p.certificates, attachedNames) };
}
