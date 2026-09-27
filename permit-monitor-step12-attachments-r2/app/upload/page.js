import { redirect } from "next/navigation";
import Header from "../components/Header";
import UploadForm from "./UploadForm";
import { createClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already enforces this; these are the page-level checks
  // Next.js recommends keeping alongside it, not a replacement for it.
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");

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
