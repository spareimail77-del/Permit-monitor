// Permit archive: when a new Excel no longer contains a permit that the
// previous Excel had, that permit's row is saved to the archived_permits
// table (one row per permit number, so uploading every day never
// creates duplicates). Only the permits that dropped out are written;
// nothing is stored for permits that are still on the sheet.

export function findRemovedPermits(oldPermits, newPermits) {
  const stillThere = new Set(newPermits.map((p) => p.reference));
  const removed = new Map(); // keyed by reference -> one row per permit no.
  for (const p of oldPermits) {
    if (!stillThere.has(p.reference)) removed.set(p.reference, p);
  }
  return [...removed.values()];
}

export async function archivePermits(supabase, userId, removed) {
  if (removed.length === 0) return { count: 0 };

  const now = new Date().toISOString();
  const rows = removed.map((p) => {
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
      archived_at: now,
      archived_by: userId,
    };
  });

  // Chunked so a large clean-up can't exceed request limits.
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase
      .from("archived_permits")
      .upsert(rows.slice(i, i + 200), { onConflict: "reference" });
    if (error) throw error;
  }
  return { count: rows.length };
}
