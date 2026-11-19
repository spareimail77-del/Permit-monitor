"use client";

import { uploadPermitFiles } from "./uploadFiles";

// "Save & close" of the check-before-closing popup, for ONE permit:
//   1. the certificate copies are uploaded first (same safe path as everywhere else),
//   2. then the filled-in details are saved and the permit is closed in ONE server step.
// If a file fails, nothing is closed and the person can try again. Files that were
// already added are reported in `done`, so a retry does not upload them twice.
//
// draft: { values: { holder, issuer, areaAuthority }, files: { [certificateName]: File } }
// Returns { ok: true, done } or { ok: false, error, done }.
export async function closeWithFixes(permitId, draft) {
  const values = draft?.values || {};
  const entries = Object.entries(draft?.files || {}).filter(([, file]) => file);
  const done = [];

  if (entries.length > 0) {
    const up = await uploadPermitFiles(
      permitId,
      entries.map(([name, file]) => ({ file, kind: "certificate", label: name }))
    );
    const failedNames = new Set(up.failed.map((f) => f.name));
    if (up.saved > 0) for (const [name, file] of entries) if (!failedNames.has(file.name)) done.push(name);
    if (up.failed.length > 0) {
      return {
        ok: false,
        done,
        error: `The certificate copy could not be added (${up.failed.map((f) => `${f.name}: ${f.reason}`).join("; ")}). The permit was not closed.`,
      };
    }
  }

  const fill = {};
  for (const key of ["holder", "issuer", "areaAuthority"]) {
    const v = String(values[key] ?? "").trim();
    if (v) fill[key] = v;
  }

  try {
    const res = await fetch(`/api/permits/${permitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close", fill }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, done, error: data.error || "The permit could not be closed." };
    return { ok: true, done };
  } catch {
    return { ok: false, done, error: "Network error. Check your connection and try again." };
  }
}
