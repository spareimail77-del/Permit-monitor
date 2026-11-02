import { redirect } from "next/navigation";
import PageHeader from "../components/PageHeader";
import ListsAdmin from "./ListsAdmin";
import { getSupabase, fetchUsage, usageOf } from "../../lib/db";
import { getViewer } from "../../lib/viewer";
import { OPTION_LISTS } from "../../lib/permitRules";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const viewer = await getViewer();
  if (!viewer?.canManageOptions) redirect("/");

  const supabase = getSupabase();
  const [{ data, error }, usage] = await Promise.all([
    supabase
    .from("permit_options")
    .select("id, list, value, active, sort")
    .order("sort", { ascending: true })
    .order("value", { ascending: true })
    .limit(5000),
    fetchUsage(supabase),
  ]);

  const byList = Object.fromEntries(OPTION_LISTS.map((l) => [l.key, []]));
  for (const o of data || []) if (byList[o.list]) byList[o.list].push({ id: o.id, value: o.value, active: o.active, used: usageOf(usage, o.list, o.value) });

  return (
    <>
      <PageHeader
        title="Dropdown lists"
        crumbs={[{ label: "Dashboard", href: "/" }, { label: "Dropdown lists" }]}
        sub="The choices on the permit form, most used first. Values are saved in UPPER CASE. Hide, rename or delete a value here: permits already saved always keep the text they have."
      />
      {error && (
        <div className="notice notice--danger">
          The lists could not be read. Have <span className="mono">supabase/05-edit-delete-lists.sql</span> and <span className="mono">08-locations.sql</span> been run?
        </div>
      )}
      <ListsAdmin lists={OPTION_LISTS} values={byList} isRoot={viewer.role === "root"} />
    </>
  );
}
