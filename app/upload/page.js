import { redirect } from "next/navigation";
import Header from "../components/Header";
import UploadForm from "./UploadForm";
import { createClient } from "../../lib/supabase/server";
import { getAccess, hasPermission } from "../../lib/authz";

export const dynamic = "force-dynamic";

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

  return (
    <main style={styles.main}>
      <Header />
      <section style={styles.body}>
        <UploadForm />
      </section>
    </main>
  );
}

const styles = {
  main: { minHeight: "100svh" },
  body: { maxWidth: 720, margin: "0 auto", padding: "32px 20px" },
};
