import Link from "next/link";

// Tabs of the Admin area, with a small count where something is waiting.
export default function AdminNav({ active, counts = {} }) {
  const tabs = [
    { key: "users", href: "/admin/users", label: "Users", n: counts.pendingUsers },
    { key: "passwords", href: "/admin/password-requests", label: "Password requests", n: counts.passwordRequests },
    { key: "ids", href: "/admin/id-changes", label: "Staff ID changes", n: counts.idChanges },
  ];
  return (
    <nav className="admin-nav" aria-label="Admin">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className={t.key === active ? "admin-nav__tab is-active" : "admin-nav__tab"}>
          {t.label}
          {t.n > 0 && <span className="admin-nav__count">{t.n}</span>}
        </Link>
      ))}
    </nav>
  );
}
