"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// The main navigation in the top bar. On a phone the links fold into a menu button.
export default function TopNav({ canCreate }) {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const navRef = useRef(null);
  const buttonRef = useRef(null);

  // Close after every page change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // While open: Esc closes (and returns focus to the button); a click elsewhere closes.
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onDown(e) {
      if (navRef.current && !navRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const items = [
    { href: "/", label: "Dashboard", active: pathname === "/" },
    { href: "/permits", label: "Permits", active: pathname === "/permits" || (pathname.startsWith("/permits/") && pathname !== "/permits/new") },
  ];

  return (
    <nav className="topnav" aria-label="Main" ref={navRef}>
      <button
        type="button"
        ref={buttonRef}
        className="topnav__toggle"
        aria-expanded={open}
        aria-controls="topnav-list"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <ul id="topnav-list" className={open ? "topnav__list is-open" : "topnav__list"}>
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} className="topnav__link" aria-current={it.active ? "page" : undefined}>
              {it.label}
            </Link>
          </li>
        ))}
        {canCreate && (
          <li>
            <Link href="/permits/new" className="btn btn-primary btn-sm" aria-current={pathname === "/permits/new" ? "page" : undefined}>
              + New permit
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
