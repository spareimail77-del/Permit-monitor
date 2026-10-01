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
