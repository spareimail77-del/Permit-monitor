"use client";

// Sends files for one permit. For each file: the server checks it and returns
// signed values, the browser sends the file straight to Cloudinary (the Vercel
// free plan refuses bodies over about 4.5 MB), and at the end the server records
// them all (and checks them again).
// items: [{ file, kind, label }]
// Returns { saved: number, failed: [{ name, reason }] }
export async function uploadPermitFiles(permitId, items) {
  const uploaded = [];
  const failed = [];

  for (const item of items) {
    const { file } = item;
    try {
      const signRes = await fetch(`/api/permits/${permitId}/files/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, sizeBytes: file.size }),
      });
      const sign = await signRes.json().catch(() => ({}));
      if (!signRes.ok) {
        failed.push({ name: file.name, reason: sign.error || "not accepted" });
        continue;
      }

      const form = new FormData();
      for (const [key, value] of Object.entries(sign.params)) form.append(key, value);
      form.append("file", file);
      const up = await fetch(sign.uploadUrl, { method: "POST", body: form });
      if (!up.ok) {
        failed.push({ name: file.name, reason: "upload failed" });
        continue;
      }

      uploaded.push({
        kind: item.kind,
        label: item.label || "",
        fileName: file.name,
        storagePath: sign.storageKey,
        contentType: file.type,
        sizeBytes: file.size,
      });
    } catch {
      failed.push({ name: file.name, reason: "network error" });
    }
  }

  if (uploaded.length === 0) return { saved: 0, failed };

  try {
    const res = await fetch(`/api/permits/${permitId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: uploaded }),
    });
    if (res.ok) return { saved: uploaded.length, failed };
    const data = await res.json().catch(() => ({}));
    for (const u of uploaded) failed.push({ name: u.fileName, reason: data.error || "not recorded" });
    return { saved: 0, failed };
  } catch {
    for (const u of uploaded) failed.push({ name: u.fileName, reason: "network error" });
    return { saved: 0, failed };
  }
}
