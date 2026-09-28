import { can } from "./permissions";

// Reads the signed-in user's role and account status from their profile.
export async function getAccess(supabase, userId) {
  const { data } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", userId)
    .single();
  return {
    role: data?.role ?? null,
    status: data?.status ?? null,
    active: data?.status === "active",
  };
}

// Pending and disabled accounts have no permissions at all.
export function hasPermission(access, permission) {
  return access.active && can(access.role, permission);
}
