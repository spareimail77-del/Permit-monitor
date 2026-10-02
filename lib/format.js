// Small display helpers shared by the upload log and the ID-change pages.
// Times are always shown in Oman time (Asia/Muscat) so the server render and
// the browser render give the same text, whatever the viewer's clock says.

export function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb).toLocaleString("en-GB")} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function formatWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    timeZone: "Asia/Muscat",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// "1 Oct 2026" in Oman time (no clock time).
export function formatDay(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    timeZone: "Asia/Muscat",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Up to two capital letters for an avatar: first letters of the first two
// words of the name, or the last two characters of the Staff ID.
export function initialsOf(name, staffId) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return String(staffId || "?").slice(-2).toUpperCase();
}
