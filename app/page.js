import Link from "next/link";
import { getSupabase } from "../lib/db";
import { getViewer } from "../lib/viewer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await getViewer();
  let count = null;
  try {
    const { count: c } = await getSupabase().from("permits").select("id", { count: "exact", head: true }).is("deleted_at", null);
    count = c;
  } catch {
    count = null;
  }

  return (
    <>
      <h2 className="page-title">Work permit register</h2>
      <p className="page-sub">
        Fill in permits and see what was stored.
        {count !== null && ` ${count} permit${count === 1 ? "" : "s"} stored so far.`}
      </p>
      <div className="home-grid">
        {viewer?.canManagePermits && (
          <Link href="/permits/new" className="panel home-card">
            <h3>New permit</h3>
            <p>Fill in the permit form. It is saved straight into the database.</p>
          </Link>
        )}
        <Link href="/permits" className="panel home-card">
          <h3>Permit list</h3>
          <p>Everything stored so far, newest first.</p>
        </Link>
      </div>
    </>
  );
}
