import { redirect } from "next/navigation";
import Header from "../components/Header";
import UploadForm from "./UploadForm";
import UploadHistory from "./UploadHistory";
import { createClient } from "../../lib/supabase/server";
import { getAccess, hasPermission } from "../../lib/authz";

export const dynamic = "force-dynamic";

const LOG_LIMIT = 100;

export default async function UploadPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already enforces this; these are the page-level checks
  // Next.js recommends keeping alongside it, not a replacement for it.
  if (!user) redirect("/login");

  const access = await getAccess(supabase, user.id);

  if (!hasPermission(access, "upload_excel")) redirect("/");

  // Newest first. If the log table is missing (migration not run yet) or the
  // read fails, the page still works and just shows no history.
  let logRows = [];
  let logProblem = false;
  try {
    const { data, error } = await supabase
      .from("upload_log")
      .select(
        "id, staff_id, display_name, file_name, size_bytes, permit_count, archived_count, status, note, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(LOG_LIMIT);
    if (error) logProblem = true;
    logRows = (data || []).map((r) => ({
      id: r.id,
      staffId: r.staff_id || "",
      name: r.display_name || "",
      fileName: r.file_name,
      sizeBytes: r.size_bytes,
      permitCount: r.permit_count,
      archivedCount: r.archived_count,
      status: r.status,
      note: r.note || "",
      at: r.created_at,
    }));
  } catch (err) {
    logProblem = true;
  }

  return (
    <main style={styles.main}>
      <Header />
      <section style={styles.body}>
        <UploadForm />
        <UploadHistory rows={logRows} problem={logProblem} limit={LOG_LIMIT} />
      </section>
    </main>
  );
}

const styles = {
  main: { minHeight: "100svh" },
  body: { maxWidth: 980, margin: "0 auto", padding: "32px 20px", display: "grid", gap: 22 },
};
