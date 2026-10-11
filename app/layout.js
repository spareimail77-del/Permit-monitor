import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "HSE Permits",
  description: "SWWS Salalah HSE — work permit register",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header__inner">
            <Link href="/" className="site-title">
              <span className="site-title__small">SWWS — Salalah</span>
              HSE Permits
            </Link>
            <nav className="site-nav">
              <Link href="/permits">Permit list</Link>
              <Link href="/permits/new" className="btn btn-primary btn-sm">
                + New permit
              </Link>
            </nav>
          </div>
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
