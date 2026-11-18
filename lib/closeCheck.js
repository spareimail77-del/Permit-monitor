// "Is this permit complete enough to close?"
//
// Holder, issuer and area authority may be left empty when a permit is saved (they are
// often filled in later). Closing is the last moment to catch that, so every place that
// closes a permit asks this one function which of them are still empty.
//
// To check more fields, add them to CLOSE_CHECK_FIELDS: nothing else needs to change.
// "NA" counts as filled (it is how the form says "not applicable").
//
// It accepts a database row (area_authority) or the form values (areaAuthority).

export const CLOSE_CHECK_FIELDS = [
  { key: "holder", label: "Permit holder", read: (p) => p.holder },
  { key: "issuer", label: "Authorized permit issuer", read: (p) => p.issuer },
  { key: "areaAuthority", label: "Area authority", read: (p) => p.area_authority ?? p.areaAuthority },
];

// -> [{ key: "issuer", label: "Authorized permit issuer" }, ...]  ([] = complete)
export function missingForClose(permit) {
  const p = permit && typeof permit === "object" ? permit : {};
  return CLOSE_CHECK_FIELDS.filter((f) => String(f.read(p) ?? "").trim() === "").map(({ key, label }) => ({ key, label }));
}
