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

  // The icons only show in the phone menu (CSS hides them on a wide screen).
  const items = [
    { href: "/", label: "Dashboard", icon: "M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z", active: pathname === "/" },
    {
      href: "/permits",
      label: "Permits",
      icon: "M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h4",
      active: pathname === "/permits" || (pathname.startsWith("/permits/") && pathname !== "/permits/new"),
    },
  ];
  const Icon = ({ d }) => (
    <svg className="topnav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );

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
      {/* Phone only: dims the page behind the open menu; a tap on it closes the menu. */}
      <div className={open ? "topnav__backdrop is-open" : "topnav__backdrop"} onClick={() => setOpen(false)} aria-hidden="true" />
      <ul id="topnav-list" className={open ? "topnav__list is-open" : "topnav__list"}>
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} className="topnav__link" aria-current={it.active ? "page" : undefined}>
              <Icon d={it.icon} />
              {it.label}
            </Link>
          </li>
        ))}
        {canCreate && (
          <li className="topnav__cta">
            <Link href="/permits/new" className="btn btn-primary btn-sm" aria-current={pathname === "/permits/new" ? "page" : undefined}>
              <Icon d="M12 5v14M5 12h14" />
              <span className="topnav__plus" aria-hidden="true">+</span>New permit
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
