import Link from "next/link";
import { getSupabase } from "../lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  let count = null;
  try {
    const { count: c } = await getSupabase().from("permits").select("id", { count: "exact", head: true });
    count = c;
  } catch {
    count = null;
  }

  return (
    <>
      <h2 className="page-title">Work permit register</h2>
      <p className="page-sub">
        Step A skeleton: fill the permit form, and see what was stored.
        {count !== null && ` ${count} permit${count === 1 ? "" : "s"} stored so far.`}
      </p>
      <div className="home-grid">
        <Link href="/permits/new" className="panel home-card">
          <h3>New permit</h3>
          <p>Fill in the permit form. It is saved straight into the database.</p>
        </Link>
        <Link href="/permits" className="panel home-card">
          <h3>Permit list</h3>
          <p>Everything stored so far, newest first.</p>
        </Link>
      </div>
    </>
  );
}
