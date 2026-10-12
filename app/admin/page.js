import Link from "next/link";
import { guardAdminPage } from "../../lib/adminPage";
import { getAdminCounts } from "../../lib/adminCounts";
import CountsSync from "../components/CountsSync";
import KeyMissing from "./KeyMissing";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const { admin } = await guardAdminPage();
  if (!admin) return <KeyMissing />;
  const c = await getAdminCounts(admin);

  const cards = [
    { href: "/admin/users", title: "Users", n: c.pendingUsers, waiting: "account request(s) waiting", text: "Approve requests, change roles, disable or remove accounts." },
    { href: "/admin/password-requests", title: "Password requests", n: c.passwordRequests, waiting: "request(s) waiting", text: "Give a temporary password to someone who forgot theirs." },
    { href: "/admin/id-changes", title: "Staff ID changes", n: c.idChanges, waiting: "request(s) waiting", text: "Approve or reject a change of Staff ID." },
  ];

  return (
    <>
      <CountsSync counts={c} />
      <h2 className="page-title">Admin</h2>
      <p className="page-sub">Root only.</p>
      <div className="home-grid">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="panel home-card">
            <h3>{card.title}</h3>
            <p>{card.text}</p>
            {card.n > 0 && (
              <p style={{ marginTop: 8, color: "var(--danger)", fontWeight: 700 }}>
                {card.n} {card.waiting}
              </p>
            )}
          </Link>
        ))}
      </div>
    </>
  );
}
