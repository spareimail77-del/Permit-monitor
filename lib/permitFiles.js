// What is attached to each permit, read with ONE query pass for the whole list
// (not one query per row). Only permit_id and kind are read; nothing is changed.

const PAGE = 1000;

// Returns { map, ok }. map: permit id -> { permit_copy, jsa, certificate, other } counts.
export async function fetchFileSummary(supabase) {
  const map = new Map();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("permit_files")
      .select("permit_id, kind")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("Reading permit files failed:", error);
      return { map: new Map(), ok: false };
    }
    for (const r of data || []) {
      const c = map.get(r.permit_id) || { permit_copy: 0, jsa: 0, certificate: 0, other: 0 };
      if (r.kind in c) c[r.kind] += 1;
      map.set(r.permit_id, c);
    }
    if (!data || data.length < PAGE) break;
  }
  return { map, ok: true };
}

const EMPTY = { permit_copy: 0, jsa: 0, certificate: 0, other: 0 };

// Adds .files and .fileCount to every row (only when the files could be read).
export function withFiles(rows, summary) {
  if (!summary.ok) return rows;
  return rows.map((r) => {
    const files = summary.map.get(r.id) || EMPTY;
    return { ...r, files, fileCount: files.permit_copy + files.jsa + files.certificate + files.other };
  });
}

const n = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// "Permit copy, JSA, 2 certificates"
export function describeFiles(f) {
  if (!f) return "";
  const parts = [];
  if (f.permit_copy) parts.push(f.permit_copy === 1 ? "Permit copy" : n(f.permit_copy, "permit copy", "permit copies"));
  if (f.jsa) parts.push(f.jsa === 1 ? "JSA" : `${f.jsa} JSAs`);
  if (f.certificate) parts.push(n(f.certificate, "certificate", "certificates"));
  if (f.other) parts.push(n(f.other, "other document", "other documents"));
  return parts.join(", ");
}

// What an active permit still lacks: [] or ["permit copy"], ["JSA"], ["permit copy", "JSA"].
export function missingDocs(f) {
  if (!f) return [];
  const out = [];
  if (!f.permit_copy) out.push("permit copy");
  if (!f.jsa) out.push("JSA");
  return out;
}
