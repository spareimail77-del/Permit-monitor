"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import { can } from "../../lib/permissions";

const BASE_NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/permits", label: "Permit List" },
];

export default function Header({ uploadedAt, today }) {
  const pathname = usePathname();
  const [me, setMe] = useState(null); // { email, role, displayName } | null while loading

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const navItems =
    can(me?.role, "view_admin_page")
      ? [...BASE_NAV_ITEMS, { href: "/admin", label: "Admin" }]
      : BASE_NAV_ITEMS;

  return (
    <header className="hero">
      <div className="hero-inner" style={styles.headerInner}>
        <div>
          <p style={styles.eyebrow}>SWWS — Salalah</p>
          <h1 style={styles.title}>Permit Log Register</h1>
        </div>
        <nav style={styles.nav}>
          {navItems.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
            return (
              <Link prefetch={false}
                key={item.href}
                href={item.href}
                className={`nav-link${active ? " is-active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
          <ThemeToggle />
          {me?.staffId && <UserMenu name={me.displayName} role={me.role} />}
        </nav>
      </div>
      {(uploadedAt || today) && (
        <div className="hero-inner" style={styles.meta}>
          <div style={styles.metaInner}>
            {uploadedAt && (
              <span>
                Data as of{" "}
                <span className="mono">
                  {new Date(uploadedAt).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </span>
            )}
            {today && (
              <span style={{ marginLeft: 16 }}>
                Calculated for <span className="mono">{today}</span> (Oman time)
              </span>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

const styles = {
  headerInner: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "26px 20px 22px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: 16,
  },
  eyebrow: {
    margin: 0,
    fontFamily: "var(--font-mono)",
    fontSize: "var(--font-size-xs)",
    letterSpacing: "0.04em",
    color: "var(--color-brand-2)",
  },
  title: {
    marginTop: 6,
    fontSize: "var(--font-size-2xl)",
    color: "var(--color-ink)",
  },
  nav: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" },
  meta: {
    borderTop: "1px solid var(--color-rule)",
  },
  metaInner: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "10px 20px",
    fontSize: "var(--font-size-xs)",
    color: "var(--color-ink-muted)",
  },
};
