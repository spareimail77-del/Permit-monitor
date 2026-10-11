import { redirect } from "next/navigation";
import { getViewer } from "./viewer";
import { can } from "./permissions";
import { createAdminClient } from "./supabase/admin";

// For the Admin pages (server side). Root only. `admin` is null when the
// service key is not set, so the page can say so instead of crashing.
export async function guardAdminPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!can(viewer.role, "manage_users")) redirect("/");
  let admin = null;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error(e);
  }
  return { viewer, admin };
}
