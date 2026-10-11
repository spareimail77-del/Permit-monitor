"use client";

import { getBrowserSupabase } from "./supabaseBrowser";
import { FILE_BUCKET, safeFileName } from "./fileRules";

// Sends files for one permit: each file goes straight from the browser to
// storage, then the server records them (and checks them again).
// items: [{ file, kind, label }]
// Returns { saved: number, failed: [{ name, reason }] }
export async function uploadPermitFiles(permitId, items) {
  const supabase = getBrowserSupabase();
  const uploaded = [];
  const failed = [];

  for (const item of items) {
    const path = `${permitId}/${crypto.randomUUID()}-${safeFileName(item.file.name)}`;
    const { error } = await supabase.storage
      .from(FILE_BUCKET)
      .upload(path, item.file, { contentType: item.file.type, upsert: false });
    if (error) {
      failed.push({ name: item.file.name, reason: "upload failed" });
      continue;
    }
    uploaded.push({
      path,
      meta: {
        kind: item.kind,
        label: item.label || "",
        fileName: item.file.name,
        storagePath: path,
        contentType: item.file.type,
        sizeBytes: item.file.size,
      },
    });
  }

  if (uploaded.length === 0) return { saved: 0, failed };

  try {
    const res = await fetch(`/api/permits/${permitId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: uploaded.map((u) => u.meta) }),
    });
    if (res.ok) return { saved: uploaded.length, failed };
    // The server refused the records: remove the files so nothing is left behind.
    await supabase.storage.from(FILE_BUCKET).remove(uploaded.map((u) => u.path));
    const data = await res.json().catch(() => ({}));
    for (const u of uploaded) failed.push({ name: u.meta.fileName, reason: data.error || "not recorded" });
    return { saved: 0, failed };
  } catch {
    for (const u of uploaded) failed.push({ name: u.meta.fileName, reason: "network error" });
    return { saved: 0, failed };
  }
}
