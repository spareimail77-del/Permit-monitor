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

// The signed-in person's name and role rarely change, but every page used to
// ask the server for them again on each navigation (a full extra request, so
// the user menu and Admin link popped in late). The answer is now remembered
// for this browser tab for a few minutes: shown at once, re-checked only when
// it is older than that. Nothing here grants access: the server still checks
// the role on every page and API call.
const ME_CACHE_KEY = "permit-log-me";
const ME_CACHE_MS = 5 * 60 * 1000;

export default function Header({ uploadedAt, today }) {
  const pathname = usePathname();
  const [me, setMe] = useState(null); // { email, role, displayName } | null while loading

  useEffect(() => {
    let cancelled = false;

    function remember(data) {
      try {
        if (data && data.staffId) {
          window.sessionStorage.setItem(ME_CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
        } else {
          window.sessionStorage.removeItem(ME_CACHE_KEY);
        }
      } catch (err) {
        // storage unavailable - fine, it just won't be remembered
      }
    }

    function loadFromServer() {
      fetch("/api/auth/me")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled) return;
          setMe(data);
          remember(data);
        })
        .catch(() => {
          if (!cancelled) setMe(null);
        });
    }

    // My profile announces a changed name: ask the server again right away.
    window.addEventListener("permit:me-changed", loadFromServer);

    try {
      const raw = window.sessionStorage.getItem(ME_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached && cached.data && cached.data.staffId) {
          setMe(cached.data);
          if (Date.now() - cached.at < ME_CACHE_MS) {
            return () => {
              cancelled = true;
              window.removeEventListener("permit:me-changed", loadFromServer);
            };
          }
        }
      }
    } catch (err) {
      // storage unavailable or unreadable - just ask the server
    }

    loadFromServer();
    return () => {
      cancelled = true;
      window.removeEventListener("permit:me-changed", loadFromServer);
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
