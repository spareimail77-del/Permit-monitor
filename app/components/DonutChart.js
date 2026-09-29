"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// segments: [{ key, label, value, color, href? }]
// Pure SVG + CSS (no chart library). Hover or keyboard-focus a slice or
// a legend row and the two stay in sync: the slice grows, the others dim
// and the centre shows that slice's count and share. Click opens the
// permit list filtered to that status.

const SIZE = 240;
const STROKE = 26;
const STROKE_ACTIVE = 34;
const RADIUS = SIZE / 2 - STROKE_ACTIVE / 2 - 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2.5; // visual gap between slices, in SVG units

function percentText(value, total) {
  if (!total || !value) return "0%";
  const pct = (value / total) * 100;
  return pct < 1 ? "<1%" : `${Math.round(pct)}%`;
}

export default function DonutChart({ segments, total, centerLabel = "permits" }) {
  const router = useRouter();
  const [activeKey, setActiveKey] = useState(null);

  const drawn = segments.filter((s) => s.value > 0);
  const gap = drawn.length > 1 ? GAP : 0;

  let offset = 0;
  const arcs = drawn.map((s, i) => {
    const length = total > 0 ? (s.value / total) * CIRCUMFERENCE : 0;
    const visible = Math.max(length - gap, 0.5);
    const arc = { ...s, i, visible, offset };
    offset += length;
    return arc;
  });

  const active = segments.find((s) => s.key === activeKey) || null;
  const go = (s) => s.href && router.push(s.href);

  return (
    <div className="donut-row">
      <div className="donut-wrap">
        <svg
          className={`donut-svg${active ? " has-active" : ""}`}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="group"
          aria-label="Permit status distribution"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-surface-2)"
            strokeWidth={STROKE}
          />
          {arcs.map((a) => (
            <circle
              key={a.key}
              className={`donut-slice${a.key === activeKey ? " is-active" : ""}`}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={a.color}
              strokeDasharray={`${a.visible} ${CIRCUMFERENCE - a.visible}`}
              strokeDashoffset={-a.offset}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              style={{
                "--len": a.visible,
                "--circ": CIRCUMFERENCE,
                "--rest": CIRCUMFERENCE - a.visible,
                "--i": a.i,
              }}
              tabIndex={0}
              role="link"
              aria-label={`${a.label}: ${a.value} of ${total} permits (${percentText(a.value, total)})`}
              onMouseEnter={() => setActiveKey(a.key)}
              onMouseLeave={() => setActiveKey(null)}
              onFocus={() => setActiveKey(a.key)}
              onBlur={() => setActiveKey(null)}
              onClick={() => go(a)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  go(a);
                }
              }}
            />
          ))}
          <g className="donut-center" key={active ? active.key : "total"} pointerEvents="none">
            <text
              x={SIZE / 2}
              y={SIZE / 2 - 2}
              textAnchor="middle"
              className="donut-center__value"
              fill={active ? active.color : "var(--color-ink)"}
            >
              {active ? active.value : total}
            </text>
            <text x={SIZE / 2} y={SIZE / 2 + 22} textAnchor="middle" className="donut-center__label">
              {active ? active.label : centerLabel}
            </text>
            {active && (
              <text x={SIZE / 2} y={SIZE / 2 + 40} textAnchor="middle" className="donut-center__pct">
                {percentText(active.value, total)} of all permits
              </text>
            )}
          </g>
        </svg>
      </div>

      <ul className="donut-legend">
        {segments.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              className={`donut-legend__row${s.key === activeKey ? " is-active" : ""}${
                s.value === 0 ? " is-empty" : ""
              }`}
              onMouseEnter={() => setActiveKey(s.key)}
              onMouseLeave={() => setActiveKey(null)}
              onFocus={() => setActiveKey(s.key)}
              onBlur={() => setActiveKey(null)}
              onClick={() => go(s)}
            >
              <span className="legend-dot" style={{ background: s.color }} />
              <span className="donut-legend__label">{s.label}</span>
              <span className="donut-legend__count">{s.value}</span>
              <span className="donut-legend__pct">{percentText(s.value, total)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
