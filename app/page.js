export default function Home() {
  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <p style={styles.eyebrow}>SWWS — Salalah</p>
          <h1 style={styles.title}>Permit Log Register</h1>
        </div>
      </header>

      <section style={styles.body}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Project skeleton deployed</h2>
          <p style={styles.cardText}>
            This confirms the site builds and deploys on Vercel. No permit
            data is connected yet — that comes in the next steps:
          </p>
          <ol style={styles.list}>
            <li>Vercel Blob storage + upload page</li>
            <li>Excel file reader</li>
            <li>Expiring Soon rule</li>
            <li>Dashboard, permit list, and detail pages</li>
          </ol>
        </div>
      </section>
    </main>
  );
}

const styles = {
  main: {
    minHeight: "100dvh",
  },
  header: {
    background: "var(--color-brand-dark)",
    color: "#fff",
  },
  headerInner: {
    maxWidth: 960,
    margin: "0 auto",
    padding: "28px 20px",
  },
  eyebrow: {
    margin: 0,
    fontFamily: "var(--font-mono)",
    fontSize: "var(--font-size-xs)",
    letterSpacing: "0.04em",
    color: "#bfe3ec",
  },
  title: {
    marginTop: 6,
    fontSize: "var(--font-size-2xl)",
  },
  body: {
    maxWidth: 960,
    margin: "0 auto",
    padding: "32px 20px",
  },
  card: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-rule)",
    borderRadius: "var(--radius-md)",
    padding: "24px 28px",
  },
  cardTitle: {
    fontSize: "var(--font-size-lg)",
    marginBottom: 8,
  },
  cardText: {
    color: "var(--color-ink-muted)",
    marginTop: 0,
  },
  list: {
    color: "var(--color-ink-muted)",
    lineHeight: 1.8,
  },
};
