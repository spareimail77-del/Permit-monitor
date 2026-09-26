"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import Icon from "./Icon";

export default function UserMenu({ me }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onEscape(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  if (!me?.staffId) return null;

  return (
    <div ref={rootRef} style={styles.root}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        title={me.email ? `${me.email} · ${me.role}` : me.role}
      >
        <span style={styles.avatar}>
          <Icon name="user" size={15} />
        </span>
        <span style={styles.triggerLabel}>{me.staffId}</span>
        <Icon name="chevronDown" size={13} style={{ opacity: 0.6 }} />
      </button>

      {open && (
        <div role="menu" style={styles.menu}>
          <div style={styles.menuHead}>
            <p style={styles.menuStaffId}>{me.staffId}</p>
            <p style={styles.menuRole}>{me.role === "admin" ? "Admin" : "User"}</p>
            {me.email && <p style={styles.menuEmail}>{me.email}</p>}
          </div>
          <div style={styles.menuDivider} />
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            style={styles.menuItem}
          >
            <Icon name="logout" size={14} />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  root: { position: "relative" },
  trigger: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px 5px 5px",
    borderRadius: 999,
    border: "1px solid var(--color-rule)",
    background: "var(--color-surface-2)",
    color: "var(--color-ink)",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "var(--font-size-xs)",
    fontWeight: 700,
  },
  avatar: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "linear-gradient(135deg, var(--color-brand-2), var(--color-brand-dark))",
    color: "#fff",
  },
  triggerLabel: { letterSpacing: "0.02em" },
  menu: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    minWidth: 200,
    background: "var(--color-surface)",
    border: "1px solid var(--color-rule)",
    borderRadius: "var(--radius-md)",
    boxShadow: "var(--shadow-pop)",
    padding: 8,
    zIndex: 40,
  },
  menuHead: { padding: "6px 10px 10px" },
  menuStaffId: {
    margin: 0,
    fontSize: "var(--font-size-sm)",
    fontWeight: 700,
    color: "var(--color-ink)",
  },
  menuRole: {
    margin: "2px 0 0",
    fontSize: "var(--font-size-xs)",
    color: "var(--color-brand-2)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  menuEmail: {
    margin: "6px 0 0",
    fontSize: "var(--font-size-xs)",
    color: "var(--color-ink-muted)",
    wordBreak: "break-all",
  },
  menuDivider: { height: 1, background: "var(--color-rule)", margin: "2px 0 6px" },
  menuItem: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    background: "transparent",
    border: "none",
    borderRadius: "var(--radius-sm)",
    color: "var(--color-expired)",
    fontFamily: "inherit",
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
  },
};
