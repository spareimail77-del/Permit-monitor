"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ROLE_LABELS } from "../../lib/permissions";
import Icon from "./Icon";
import { createClient } from "../../lib/supabase/client";

export default function UserMenu({ name, role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null); // { top, left, width, maxHeight }

  // Position the menu against the viewport (position: fixed) instead of
  // the trigger's box, so it can never spill off either screen edge on
  // a narrow phone. It is clamped 8px inside the screen and scrolls
  // internally if the screen is too short to show it all.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    function place() {
      const r = triggerRef.current.getBoundingClientRect();
      const margin = 8;
      const width = Math.min(220, window.innerWidth - margin * 2);
      const left = Math.max(
        margin,
        Math.min(r.right - width, window.innerWidth - width - margin)
      );
      const top = r.bottom + 8;
      setPos({
        top,
        left,
        width,
        maxHeight: Math.max(120, window.innerHeight - top - margin),
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    function onClickAway(e) {
      const inside =
        rootRef.current?.contains(e.target) || menuRef.current?.contains(e.target);
      if (!inside) setOpen(false);
    }
    function onEscape(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = (name || "?").trim().charAt(0).toUpperCase();

  return (
    <div ref={rootRef} style={styles.root}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span style={styles.avatar}>{initial}</span>
        <span style={styles.name}>{name}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
            flexShrink: 0,
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            ...styles.menu,
            top: pos.top,
            left: pos.left,
            width: pos.width,
            maxHeight: pos.maxHeight,
          }}
        >
          <div style={styles.menuHead}>
            <p style={styles.menuName}>{name}</p>
            <p style={styles.menuRole}>{ROLE_LABELS[role] || "User"}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              router.push("/change-password");
            }}
            style={styles.menuItem}
          >
            <Icon name="lock" size={15} />
            Change password
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            style={styles.menuItem}
          >
            <Icon name="logout" size={15} />
            Sign out
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

const styles = {
  root: { position: "relative" },
  trigger: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-rule)",
    borderRadius: 999,
    padding: "5px 12px 5px 5px",
    cursor: "pointer",
    color: "var(--color-ink)",
    fontFamily: "inherit",
  },
  avatar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: "linear-gradient(135deg, var(--color-brand-2), var(--color-brand-dark))",
    color: "#fff",
    fontSize: "var(--font-size-xs)",
    fontWeight: 700,
    flexShrink: 0,
  },
  name: {
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
    maxWidth: 120,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  menu: {
    position: "fixed",
    background: "var(--color-surface)",
    border: "1px solid var(--color-rule)",
    borderRadius: "var(--radius-sm)",
    boxShadow: "var(--shadow-pop)",
    overflowY: "auto",
    zIndex: 1000,
  },
  menuHead: {
    padding: "12px 14px",
    borderBottom: "1px solid var(--color-rule)",
  },
  menuName: {
    margin: 0,
    fontSize: "var(--font-size-sm)",
    fontWeight: 700,
    color: "var(--color-ink)",
  },
  menuRole: {
    margin: "2px 0 0",
    fontSize: "var(--font-size-xs)",
    color: "var(--color-ink-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  menuItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "10px 14px",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
    color: "var(--color-ink)",
    textAlign: "left",
  },
};
