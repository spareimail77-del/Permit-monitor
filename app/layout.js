import "./globals.css";
import Link from "next/link";
import SignOutButton from "./components/SignOutButton";
import { getViewer } from "../lib/viewer";
import { roleLabel } from "../lib/permissions";

export const metadata = {
  title: "HSE Permits",
  description: "SWWS Salalah HSE — work permit register",
};

export default async function RootLayout({ children }) {
  const viewer = await getViewer();

  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header__inner">
            <Link href="/" className="site-title">
              <span className="site-title__small">SWWS — Salalah</span>
              HSE Permits
            </Link>
            {viewer && (
              <nav className="site-nav">
                <Link href="/permits">Permit list</Link>
                {viewer.canManagePermits && (
                  <Link href="/permits/new" className="btn btn-primary btn-sm">
                    + New permit
                  </Link>
                )}
                {viewer.canManageOptions && <Link href="/lists">Dropdown lists</Link>}
                {viewer.canViewTrash && <Link href="/trash">Trash</Link>}
                {viewer.canManageUsers && <Link href="/admin">Admin</Link>}
                <Link href="/profile" className="site-nav__user">
                  {viewer.name} <span className="site-nav__role">{roleLabel(viewer.role)}</span>
                </Link>
                <SignOutButton />
              </nav>
            )}
          </div>
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
