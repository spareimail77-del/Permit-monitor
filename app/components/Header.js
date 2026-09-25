import Link from "next/link";

export default function Header({ uploadedAt, today }) {
  return (
    <header style={styles.header}>
      <div style={styles.headerInner}>
        <div>
          <p style={styles.eyebrow}>SWWS — Salalah</p>
          <h1 style={styles.title}>Permit Log Register</h1>
        </div>
        <nav style={styles.nav}>
          <Link href="/" style={styles.navLink}>
            Dashboard
          </Link>
          <Link href="/permits" style={styles.navLink}>
            Permit List
          </Link>
          <Link href="/upload" style={styles.navLink}>
            Upload
          </Link>
        </nav>
      </div>
      {(uploadedAt || today) && (
        <div style={styles.meta}>
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
                Calculated for <span className="mono">{today}</span> (Oman
                time)
              </span>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

const styles = {
  header: { background: "var(--color-brand-dark)", color: "#fff" },
  headerInner: {
    maxWidth: 1080,
    margin: "0 auto",
    padding: "24px 20px 20px",
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
    color: "#bfe3ec",
  },
  title: { marginTop: 6, fontSize: "var(--font-size-2xl)", color: "#fff" },
  nav: { display: "flex", gap: 20 },
  navLink: {
    color: "#dcecef",
    textDecoration: "none",
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
  },
  meta: { background: "rgba(0,0,0,0.15)" },
  metaInner: {
    maxWidth: 1080,
    margin: "0 auto",
    padding: "8px 20px",
    fontSize: "var(--font-size-xs)",
    color: "#cfe6ea",
  },
};
