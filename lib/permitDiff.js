// Compares the permits of the file that was on the site with the permits of a
// newly uploaded file (matched by permit number) for the upload log:
//   added    permit number only in the new file
//   removed  permit number only in the old file
//   updated  in both files, but something a person can edit is different
// Row numbers and the "days to go" text are ignored: they change for reasons
// that are not edits. Pure functions, no database or network.

const FIELDS = [
  ["area", "Area"],
  ["location", "Location"],
  ["permitType", "Type"],
  ["jobDescription", "Job description"],
  ["certificates", "Certificates"],
  ["certificateNo", "Certificate no."],
  ["applicant", "Applicant"],
  ["holder", "Holder"],
  ["issuer", "Issuer"],
  ["areaAuthority", "Area authority"],
  ["controller", "Controller"],
  ["validFrom", "Valid from"],
  ["validTo", "Valid to"],
  ["excelStatus", "Status"],
];

// Kept small so the upload log stays light on the free database tier.
const MAX_LIST = 100; // permit numbers kept per group
const MAX_FIELDS = 8; // changed fields kept per permit
const MAX_VALUE = 60; // characters kept per value

const clean = (v) => (v == null ? "" : String(v).trim());
const short = (v) => {
  const s = clean(v);
  return s.length > MAX_VALUE ? `${s.slice(0, MAX_VALUE - 1)}…` : s;
};

function byReference(permits) {
  const map = new Map();
  for (const p of permits || []) {
    if (p.reference && !map.has(p.reference)) map.set(p.reference, p);
  }
  return map;
}

export function diffPermits(oldPermits, newPermits) {
  const before = byReference(oldPermits);
  const after = byReference(newPermits);

  const added = [];
  const removed = [];
  const updated = [];

  for (const [ref, p] of after) {
    const old = before.get(ref);
    if (!old) {
      added.push(ref);
      continue;
    }
    const fields = [];
    for (const [key, label] of FIELDS) {
      if (clean(old[key]) !== clean(p[key])) fields.push([label, short(old[key]), short(p[key])]);
    }
    if (fields.length) updated.push({ ref, f: fields });
  }
  for (const ref of before.keys()) {
    if (!after.has(ref)) removed.push(ref);
  }

  return {
    addedCount: added.length,
    updatedCount: updated.length,
    removedCount: removed.length,
    // What is stored in upload_log.changes (capped).
    changes: {
      added: added.slice(0, MAX_LIST),
      removed: removed.slice(0, MAX_LIST),
      updated: updated.slice(0, MAX_LIST).map((u) => ({ ref: u.ref, f: u.f.slice(0, MAX_FIELDS) })),
      more: {
        added: Math.max(0, added.length - MAX_LIST),
        removed: Math.max(0, removed.length - MAX_LIST),
        updated: Math.max(0, updated.length - MAX_LIST),
      },
    },
  };
}
