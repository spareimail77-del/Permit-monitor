// segments: [{ label, value, color }]
export default function DonutChart({ segments, total, centerLabel }) {
  const size = 160;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const fraction = total > 0 ? s.value / total : 0;
      const length = fraction * circumference;
      const arc = (
        <circle
          key={s.label}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeDasharray={`${length} ${circumference - length}`}
          strokeDashoffset={-offset}
          strokeLinecap="butt"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      );
      offset += length;
      return arc;
    });

  return (
    <div className="donut-row">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Permit status distribution">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={stroke}
        />
        {arcs}
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          fontSize="26"
          fontWeight="600"
          fill="var(--color-ink)"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {total}
        </text>
        <text
          x="50%"
          y="63%"
          textAnchor="middle"
          fontSize="11"
          fill="var(--color-ink-muted)"
        >
          {centerLabel || "permits"}
        </text>
      </svg>
      <ul className="donut-legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="legend-dot" style={{ background: s.color }} />
            <span className="legend-label">{s.label}</span>
            <span className="legend-value">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
