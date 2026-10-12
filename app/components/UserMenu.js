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
  const item = (href, text, count) => (
    <Link key={href} href={href} role="menuitem" tabIndex={-1} className="menu-item" onClick={close}>
      {text}
      {count > 0 && (
        <>
          <span className="menu-count" aria-hidden="true">{count}</span>
          <span className="sr-only"> ({count} waiting)</span>
        </>
      )}
    </Link>
  );

  let refreshText = "Refresh counts";
  let refreshHint = checkedAt ? `checked ${ago(checkedAt)}` : "";
  if (state === "loading") {
    refreshText = "Checking…";
    refreshHint = "";
  } else if (state === "failed") {
    refreshText = "Could not refresh. Try again";
  }

  return (
    <div className="usermenu" ref={wrapRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        ref={buttonRef}
        className="avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}${waiting > 0 ? `, ${waiting} waiting` : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        {initialsOf(name, staffId)}
        {waiting > 0 && <span className="avatar__dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="usermenu__panel">
          <div className="usermenu__head">
            <div className="usermenu__name">{name}</div>
            <div className="usermenu__meta">
              Staff ID <span className="mono">{staffId}</span>
            </div>
            <span className="usermenu__role">{roleText}</span>
          </div>

          <div role="menu" aria-label="Account" ref={menuRef}>
            <div className="menu-group">
              {item("/profile", "My profile")}
              {item("/profile#change-password", "Change password")}
              {item("/profile#staff-id", "Request Staff ID change")}
              <button type="button" role="menuitem" tabIndex={-1} className="menu-item" onClick={toggle}>
                <span className="menu-item__icon">
                  <ThemeIcon theme={theme} />
                </span>
                {themeLabel}
              </button>
            </div>

            {canAdmin && (
              <div className="menu-group" role="group" aria-labelledby="um-admin">
                <div className="menu-heading" id="um-admin">
                  Admin
                </div>
                {item("/admin/users", "Users", n.pendingUsers)}
                {item("/admin/password-requests", "Password requests", n.passwordRequests)}
                {item("/admin/id-changes", "Staff ID changes", n.idChanges)}
                <button type="button" role="menuitem" tabIndex={-1} className="menu-item menu-item--quiet" onClick={refresh} disabled={state === "loading"}>
                  {refreshText}
                  {refreshHint && <span className="menu-item__hint">{refreshHint}</span>}
                </button>
              </div>
            )}

            {canManage && (
              <div className="menu-group" role="group" aria-labelledby="um-manage">
                <div className="menu-heading" id="um-manage">
                  Manage
                </div>
                {canLists && item("/lists", "Dropdown lists")}
                {canTrash && item("/trash", "Trash")}
                {canExport && (
                  <a href="/api/export" role="menuitem" tabIndex={-1} className="menu-item" onClick={close}>
                    Export to Excel
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
