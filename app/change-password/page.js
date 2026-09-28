import { redirect } from "next/navigation";
import Header from "../components/Header";
import ChangePasswordForm from "./ChangePasswordForm";
import { createClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", user.id)
    .single();

  return (
    <main style={{ minHeight: "100svh" }}>
      <Header />
      <section style={{ maxWidth: 420, margin: "0 auto", padding: "32px 20px" }}>
        <ChangePasswordForm forced={!!profile?.must_change_password} />
      </section>
    </main>
  );
}
