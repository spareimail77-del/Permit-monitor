import Link from "next/link";
import Header from "./Header";

export default function ErrorScreen({ message }) {
  return (
    <main>
      <Header />
      <section style={styles.body}>
        <div style={styles.card}>
          <h2 style={styles.title}>Data unavailable</h2>
          <p style={styles.text}>{message}</p>
          <Link href="/upload" style={styles.link}>
            Go to the upload page →
          </Link>
        </div>
      </section>
    </main>
  );
}

const styles = {
  body: { maxWidth: 1080, margin: "0 auto", padding: "32px 20px" },
  card: {
    background: "var(--color-expired-tint)",
    border: "1px solid var(--color-expired)",
    borderRadius: "var(--radius-md)",
    padding: "24px 28px",
    maxWidth: 480,
  },
  title: {
    fontSize: "var(--font-size-lg)",
    color: "var(--color-expired)",
    marginBottom: 8,
  },
  text: { color: "var(--color-ink)", marginTop: 0 },
  link: {
    display: "inline-block",
    marginTop: 12,
    color: "var(--color-brand-dark)",
    fontWeight: 600,
  },
};
