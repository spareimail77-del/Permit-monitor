import Link from "next/link";
import Header from "./Header";
import Icon from "./Icon";

export default function ErrorScreen({ message }) {
  return (
    <main>
      <Header />
      <section style={styles.body}>
        <div className="panel" style={styles.card}>
          <span
            className="passcode-icon"
            style={{ margin: 0, background: "var(--color-expired-tint)", color: "var(--color-expired)" }}
          >
            <Icon name="alertTriangle" size={20} />
          </span>
          <h2 style={styles.title}>Data unavailable</h2>
          <p style={styles.text}>{message}</p>
          <Link href="/upload" className="btn btn-primary" style={{ marginTop: 8 }}>
            Go to the upload page
          </Link>
        </div>
      </section>
    </main>
  );
}

const styles = {
  body: { maxWidth: 1120, margin: "0 auto", padding: "32px 20px" },
  card: {
    padding: "28px 32px",
    maxWidth: 460,
  },
  title: {
    fontSize: "var(--font-size-lg)",
    color: "var(--color-ink)",
    marginBottom: 8,
    marginTop: 4,
  },
  text: { color: "var(--color-ink-muted)", marginTop: 0 },
};
