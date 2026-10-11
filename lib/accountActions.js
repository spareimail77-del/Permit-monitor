import { makeTempPassword } from "./tempPassword";

// Sets a one-time password for the account and forces a change at next sign-in.
// Returns { tempPassword } or { error }. Server only (needs the admin client).
export async function resetPasswordFor(admin, profileId) {
  const tempPassword = makeTempPassword(10);

  const flag = await admin.from("profiles").update({ must_change_password: true }).eq("id", profileId);
  if (flag.error) {
    console.error("Setting must_change_password failed:", flag.error);
    return { error: "Could not prepare the reset. Has supabase/04-users-admin.sql been run?" };
  }
  const { error } = await admin.auth.admin.updateUserById(profileId, { password: tempPassword });
  if (error) {
    console.error("Setting the temporary password failed:", error);
    return { error: "Could not set the temporary password." };
  }
  return { tempPassword };
}
