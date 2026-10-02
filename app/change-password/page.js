import { redirect } from "next/navigation";
import AuthShell from "../components/AuthShell";
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

  // Choosing a new password on purpose now lives in My profile -> Security.
  // This page stays only for the forced change after a temporary password.
  if (!profile?.must_change_password) redirect("/profile?tab=security");

  return (
    <AuthShell top={<Header />} below>
      <ChangePasswordForm forced />
    </AuthShell>
  );
}
