// Permit archive (step 39): copy on add / change, never "guess what was deleted".
//
// Every upload saves each permit of the new Excel into archived_permits (one
// row per permit number, so daily uploads never duplicate):
//   - a permit not in the archive yet      -> copied in
//   - a permit whose content changed       -> its archive copy is refreshed
//   - a permit that is unchanged           -> nothing is written
// The column in_log says whether the permit is in the latest uploaded file.
// A permit that is missing from the new file is NOT deleted from the archive;
// it is only marked in_log = false and gets archived_at = "left the log" date.
// If it comes back in a later file, in_log turns true again. Because the
// comparison is against the archive itself (not against the previous file), a
// failed or wrong upload repairs itself on the next good upload.

const PAGE = 1000; // PostgREST returns at most 1000 rows per request
const WRITE_CHUNK = 200;
const IN_CHUNK = 100; // keeps the .in() URL short

// Fields that make up a permit's content. Row number and the "days to go"
// text change for reasons that are not edits, so they are left out.
function fingerprintOf(p) {
  return JSON.stringify([
    p.area,
    p.location,
    p.permitType,
    p.jobDescription,
    p.certificates,
    p.certificateNo,
    p.applicant,
    p.holder,
    p.issuer,
    p.areaAuthority,
    p.controller,
    p.validFrom,
    p.validTo,
    p.excelStatus,
  ].map((v) => (v == null ? "" : String(v).trim())));
}

function rowFields(p, fingerprint, nowIso) {
  const { rowNumber, ...data } = p; // row numbers shift; don't keep them
  return {
    reference: p.reference,
    area: p.area || null,
    location: p.location || null,
    permit_type: p.permitType || null,
    job_description: p.jobDescription || null,
    holder: p.holder || null,
    applicant: p.applicant || null,
    valid_from: p.validFrom,
    valid_to: p.validTo,
    excel_status: p.excelStatus || null,
    data,
    fingerprint,
    in_log: true,
    updated_at: nowIso,
  };
}

function chunks(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function readArchiveState(supabase) {
  const state = new Map(); // reference -> { fingerprint, inLog }
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("archived_permits")
      .select("reference, fingerprint, in_log")
      .order("reference", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const r of data || []) {
      state.set(r.reference, { fingerprint: r.fingerprint, inLog: !!r.in_log });
    }
    if (!data || data.length < PAGE) break;
  }
  return state;
}

// permits: the parsed permits of the NEW file.
// Returns { added, refreshed, left, returned } (counts).
export async function syncArchive(supabase, userId, permits) {
  const now = new Date().toISOString();

  // One entry per permit number (the first row wins if a number repeats).
  const current = new Map();
  for (const p of permits) {
    if (p.reference && !current.has(p.reference)) current.set(p.reference, p);
  }

  const state = await readArchiveState(supabase);

  const newRows = []; // not in the archive yet
  const changedRows = []; // in the archive, content differs
  const returned = []; // unchanged, but was marked "left the log"
  for (const [reference, p] of current) {
    const fp = fingerprintOf(p);
    const known = state.get(reference);
    if (!known) {
      newRows.push({ ...rowFields(p, fp, now), archived_by: userId });
    } else if (known.fingerprint !== fp) {
      changedRows.push(rowFields(p, fp, now));
    } else if (!known.inLog) {
      returned.push(reference);
    }
  }

  // Marked "in the log" in the archive, but missing from the new file.
  const left = [];
  for (const [reference, known] of state) {
    if (known.inLog && !current.has(reference)) left.push(reference);
  }

  // New permits: archived_at defaults to now (first copied).
  for (const part of chunks(newRows, WRITE_CHUNK)) {
    const { error } = await supabase
      .from("archived_permits")
      .upsert(part, { onConflict: "reference" });
    if (error) throw error;
  }

  // Changed permits: archived_at / archived_by are left out on purpose so the
  // upsert never overwrites them. A permit that was marked "left the log" and
  // is back in the file with edits is treated like any other changed permit.
  for (const part of chunks(changedRows, WRITE_CHUNK)) {
    const { error } = await supabase
      .from("archived_permits")
      .upsert(part, { onConflict: "reference" });
    if (error) throw error;
  }

  for (const part of chunks(returned, IN_CHUNK)) {
    const { error } = await supabase
      .from("archived_permits")
      .update({ in_log: true })
      .in("reference", part);
    if (error) throw error;
  }

  for (const part of chunks(left, IN_CHUNK)) {
    const { error } = await supabase
      .from("archived_permits")
      .update({ in_log: false, archived_at: now })
      .in("reference", part);
    if (error) throw error;
  }

  const cameBack = changedRows.filter((r) => state.get(r.reference)?.inLog === false).length;

  return {
    added: newRows.length,
    refreshed: changedRows.length,
    left: left.length,
    returned: returned.length + cameBack,
  };
}
