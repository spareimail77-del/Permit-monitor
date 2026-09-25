export default function StatCard({ label, value, color, tint }) {
  return (
    <div
      style={{
        ...styles.card,
        borderTop: `3px solid ${color || "var(--color-rule-strong)"}`,
      }}
    >
      <p style={styles.value}>{value}</p>
      <p style={{ ...styles.label, color: color || "var(--color-ink-muted)" }}>
        {label}
      </p>
    </div>
  );
}

const styles = {
  card: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-rule)",
    borderRadius: "var(--radius-md)",
    padding: "18px 20px",
    minWidth: 140,
    flex: "1 1 140px",
  },
  value: {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--font-size-2xl)",
    fontWeight: 600,
    margin: 0,
    color: "var(--color-ink)",
  },
  label: {
    margin: "4px 0 0",
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
  },
};
