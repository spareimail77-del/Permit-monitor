"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import Icon from "./Icon";
import { createClient } from "../../lib/supabase/client";

const BASE_NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/permits", label: "Permit List" },
];

export default function Header({ uploadedAt, today }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState(null); // { email, role } | null while loading

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

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const navItems =
    me?.role === "admin"
      ? [...BASE_NAV_ITEMS, { href: "/upload", label: "Upload" }]
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
              <Link
                key={item.href}
                href={item.href}
                style={{
                  ...styles.navLink,
                  ...(active ? styles.navLinkActive : null),
                }}
              >
                {item.label}
              </Link>
            );
          })}
          <ThemeToggle />
          {me?.staffId && (
            <span
              style={styles.userChip}
              title={me.email ? `${me.email} · ${me.role}` : me.role}
            >
              {me.staffId} · {me.role === "admin" ? "Admin" : "User"}
            </span>
          )}
          {me?.staffId && (
            <button
              type="button"
              onClick={handleSignOut}
              className="btn btn-ghost"
              style={styles.signOutBtn}
            >
              <Icon name="logout" size={14} />
              Sign out
            </button>
          )}
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
  nav: { display: "flex", gap: 6, alignItems: "center" },
  navLink: {
    color: "var(--color-ink-muted)",
    textDecoration: "none",
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
    padding: "8px 14px",
    borderRadius: 999,
  },
  navLinkActive: {
    color: "var(--color-ink)",
    background: "var(--color-surface-2)",
  },
  userChip: {
    fontSize: "var(--font-size-xs)",
    fontWeight: 700,
    letterSpacing: "0.03em",
    textTransform: "uppercase",
    color: "var(--color-brand-2)",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid var(--color-rule)",
  },
  signOutBtn: {
    padding: "6px 12px",
    fontSize: "var(--font-size-xs)",
  },
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
