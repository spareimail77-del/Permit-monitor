"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import SignOutButton from "./SignOutButton";
import { ThemeIcon, useTheme } from "./theme";
import { useAdminCounts } from "./useAdminCounts";

// Two letters for the round button: first letters of two words, else the first two letters.
function initialsOf(name, staffId) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  const text = words.length >= 2 ? words[0][0] + words[1][0] : (words[0] || String(staffId || "?")).slice(0, 2);
  return text.toUpperCase();
}

const svg = (d) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICONS = {
  user: svg("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0"),
  users: svg("M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 3.5a4 4 0 0 1 0 7M22 21a7 7 0 0 0-4-6.3"),
  key: svg("M15 7a4 4 0 1 1-3.5 6L3 21v-3l2-2v-2h2l3.5-3.5A4 4 0 0 1 15 7zM16.5 8h.01"),
  id: svg("M3 5h18v14H3zM8 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 16a3 3 0 0 1 6 0M14 9h4M14 13h4"),
  list: svg("M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"),
  trash: svg("M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"),
  download: svg("M12 4v12M7 11l5 5 5-5M4 20h16"),
};

function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

// The round user button in the top bar and its dropdown. Keyboard: Enter, Space or
// Arrow Down opens it; arrows, Home and End move; Esc closes and returns focus to
// the button; Tab closes. What is listed depends on the role (the flags come from
// lib/viewer.js; the pages and the database still check again).
export default function UserMenu({ name, staffId, roleText, canAdmin, canLists, canTrash, canExport }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const { theme, toggle, label: themeLabel } = useTheme();
  const { counts, checkedAt, state, refresh } = useAdminCounts(canAdmin);

  const canManage = canLists || canTrash || canExport;
  const n = counts || { pendingUsers: 0, passwordRequests: 0, idChanges: 0 };
  const waiting = n.pendingUsers + n.passwordRequests + n.idChanges;

  const items = () => (menuRef.current ? Array.from(menuRef.current.querySelectorAll('[role="menuitem"]:not(:disabled)')) : []);

  // Close after every page change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // When it opens, focus goes to the first item.
  useEffect(() => {
    if (open) items()[0]?.focus();
  }, [open]);

  // A click outside closes it.
  useEffect(() => {
    if (!open) return undefined;
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function onKeyDown(e) {
    if (!open) {
      if (e.target === buttonRef.current && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[i < 0 ? list.length - 1 : (i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === "Tab") {
      // Put focus back on the button first, so Tab moves on from there.
      buttonRef.current?.focus();
      setOpen(false);
    }
  }

  const close = () => setOpen(false);
  const item = (href, text, icon, count) => (
    <Link key={href} href={href} role="menuitem" tabIndex={-1} className="menu-item" onClick={close}>
      <span className="menu-item__icon">{ICONS[icon]}</span>
      <span className="menu-item__text">{text}</span>
      {count > 0 && (
        <>
          <span className="menu-count" aria-hidden="true">{count}</span>
          <span className="sr-only"> ({count} waiting)</span>
        </>
      )}
    </Link>
  );

  let refreshLabel = checkedAt ? `Refresh counts (checked ${ago(checkedAt)})` : "Refresh counts";
  if (state === "loading") refreshLabel = "Checking…";
  else if (state === "failed") refreshLabel = "Could not refresh. Try again";

  const firstName = String(name || staffId || "").trim().split(/\s+/)[0];

  return (
    <div className="usermenu" ref={wrapRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        ref={buttonRef}
        className="userchip"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}${waiting > 0 ? `, ${waiting} waiting` : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="avatar" aria-hidden="true">
          {initialsOf(name, staffId)}
          {waiting > 0 && <span className="avatar__dot" />}
        </span>
        <span className="userchip__text">
          <span className="userchip__name">{firstName}</span>
          <span className="userchip__role">{roleText}</span>
        </span>
        <svg className="userchip__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="usermenu__panel">
          <div className="usermenu__head">
            <span className="avatar avatar--lg" aria-hidden="true">{initialsOf(name, staffId)}</span>
            <div className="usermenu__who">
              <div className="usermenu__name">{name}</div>
              <div className="usermenu__meta">
                ID <span className="mono">{staffId}</span> · {roleText}
              </div>
            </div>
          </div>

          <div role="menu" aria-label="Account" ref={menuRef}>
            <div className="menu-group">
              {item("/profile", "My profile", "user")}
              <button type="button" role="menuitem" tabIndex={-1} className="menu-item" onClick={toggle}>
                <span className="menu-item__icon">
                  <ThemeIcon theme={theme} />
                </span>
                <span className="menu-item__text">{themeLabel}</span>
              </button>
            </div>

            {canAdmin && (
              <div className="menu-group" role="group" aria-labelledby="um-admin">
                <div className="menu-heading" id="um-admin">
                  <span>Admin</span>
                  <button type="button" role="menuitem" tabIndex={-1} className="menu-refresh" onClick={refresh} disabled={state === "loading"} aria-label={refreshLabel} title={refreshLabel} data-state={state}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 11A8 8 0 0 0 5.6 6.3L4 8M4 4v4h4M4 13a8 8 0 0 0 14.4 4.7L20 16M20 20v-4h-4" />
                    </svg>
                  </button>
                </div>
                {item("/admin/users", "Users", "users", n.pendingUsers)}
                {item("/admin/password-requests", "Password requests", "key", n.passwordRequests)}
                {item("/admin/id-changes", "Staff ID changes", "id", n.idChanges)}
              </div>
            )}

            {canManage && (
              <div className="menu-group" role="group" aria-labelledby="um-manage">
                <div className="menu-heading" id="um-manage">
                  <span>Manage</span>
                </div>
                {canLists && item("/lists", "Dropdown lists", "list")}
                {canTrash && item("/trash", "Trash", "trash")}
                {canExport && (
                  <a href="/api/export" role="menuitem" tabIndex={-1} className="menu-item" onClick={close}>
                    <span className="menu-item__icon">{ICONS.download}</span>
                    <span className="menu-item__text">Export to Excel</span>
                  </a>
                )}
              </div>
            )}

            <div className="menu-group">
              <SignOutButton />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
