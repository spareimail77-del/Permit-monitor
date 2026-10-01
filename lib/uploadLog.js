import { createAdminClient } from "./supabase/admin";

// Writes one row to the upload log. Logging must never break an upload, so
// every problem is swallowed (and printed to the server log).
export async function logUpload({ userId, fileName, sizeBytes, permitCount, archivedCount, status, note }) {
  try {
    const admin = createAdminClient();

    const { data: profile } = await admin
      .from("profiles")
      .select("staff_id, display_name")
      .eq("id", userId)
      .single();

    const { error } = await admin.from("upload_log").insert({
      uploaded_by: userId,
      staff_id: profile?.staff_id || null,
      display_name: profile?.display_name || null,
      file_name: String(fileName || "unknown").slice(0, 200),
      size_bytes: Math.max(0, Math.round(Number(sizeBytes) || 0)),
      permit_count: Number.isFinite(permitCount) ? permitCount : null,
      archived_count: Number.isFinite(archivedCount) ? archivedCount : null,
      status: status === "rejected" ? "rejected" : "uploaded",
      note: note ? String(note).slice(0, 300) : null,
    });
    if (error) console.error("Upload log insert failed:", error.message);
  } catch (err) {
    console.error("Upload log failed:", err);
  }
}
