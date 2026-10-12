import "./globals.css";
import Link from "next/link";
import ThemeToggle from "./components/ThemeToggle";
import TopNav from "./components/TopNav";
import UserMenu from "./components/UserMenu";
import { getViewer } from "../lib/viewer";
import { roleLabel } from "../lib/permissions";

export const metadata = {
  title: "HSE Permits",
  description: "SWWS Salalah HSE — work permit register",
};

// Runs before the page paints: dark unless this browser chose light.
const themeScript = `try{var t=localStorage.getItem("hse-theme");document.documentElement.setAttribute("data-theme",t==="light"?"light":"dark")}catch(e){}`;

export default async function RootLayout({ children }) {
  const viewer = await getViewer();

  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <header className="site-header">
          <div className="site-header__inner">
            <Link href="/" className="site-title">
              <span className="site-title__small">SWWS — Salalah</span>
              HSE Permits
            </Link>
            {viewer ? (
              <>
                <TopNav canCreate={viewer.canManagePermits} />
                <UserMenu
                  name={viewer.name}
                  staffId={viewer.staffId}
                  roleText={roleLabel(viewer.role)}
                  canAdmin={viewer.canManageUsers}
                  canLists={viewer.canManageOptions}
                  canTrash={viewer.canViewTrash}
                  canExport={viewer.canExport}
                />
              </>
            ) : (
              <div className="site-header__right">
                <ThemeToggle />
              </div>
            )}
          </div>
        </header>
        <main id="main" className="page">
          {children}
        </main>
      </body>
    </html>
  );
}
