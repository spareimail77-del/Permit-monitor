"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Centre text defaults to `total` + `centerLabel`; pass `centerValue` /
// `centerSub` to show something else (the dashboard shows the open count).
// segments: [{ key, label, value, color, href?, children?: [{ key, label,
//   legendLabel?, value, color, href? }] }]
// Pure SVG + CSS (no chart library). The main ring shows the segments, which
// add up to `total`. A segment may have `children` (a sub-part of that
// segment, e.g. Expiring Soon inside Open): drawn as a thin inner ring whose
// coloured arc covers only the child's own share of the parent's arc (e.g.
// Expiring Soon's arc covers 17 of Open's 22-wide arc, leaving the rest of
// that inner track empty) and listed in the legend as its own flat row,
// right after its parent, styled the same as every other row. Hover or
// keyboard-focus a slice or a legend row and the two stay in sync: the slice
// grows, the others dim and the centre shows that item's count and share.
// Click opens the permit list filtered to it.

const SIZE = 240;
const STROKE = 26;
const STROKE_ACTIVE = 34;
const RADIUS = SIZE / 2 - STROKE_ACTIVE / 2 - 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2.5; // visual gap between slices, in SVG units

// Inner ring sits inside the main ring, clear of its grown (active) state.
const INNER_STROKE_ACTIVE = 14;
const INNER_RADIUS = RADIUS - STROKE_ACTIVE / 2 - 2 - INNER_STROKE_ACTIVE / 2;
const INNER_CIRCUMFERENCE = 2 * Math.PI * INNER_RADIUS;
const INNER_GAP = 1.5;

function percentText(value, total) {
  if (!total || !value) return "0%";
  const pct = (value / total) * 100;
  return pct < 1 ? "<1%" : `${Math.round(pct)}%`;
}

export default function DonutChart({
  segments,
  total,
  centerValue,
  centerLabel = "permits",
  centerSub,
}) {
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

  // Inner ring pieces: one group per parent arc, laid along that arc. Each
  // child gets a slice of the parent's visible angle sized to its own share
  // of the parent's value (e.g. Expiring Soon is 17 of Open's 22, so its
  // inner arc covers 17/22 of Open's outer arc). Unlike the outer ring,
  // there is no "leftover" filler drawn in the parent's own colour — that
  // used to sit right next to the child's colour with only a hairline gap
  // and read as one arc bleeding into another. Leaving the rest of the
  // inner track empty instead makes it unambiguous: colour = only children.
  const inner = [];
  for (const a of arcs) {
    if (!a.children || a.children.length === 0) continue;
    const span = (a.visible / CIRCUMFERENCE) * INNER_CIRCUMFERENCE;
    const start = (a.offset / CIRCUMFERENCE) * INNER_CIRCUMFERENCE;
    const parts = a.children
      .filter((c) => c.value > 0)
      .map((c) => ({ ...c, parentKey: a.key, share: c.value }));
    const g = parts.length > 1 ? INNER_GAP : 0;
    let pos = start;
    for (const p of parts) {
      const len = (p.share / a.value) * span;
      const visible = Math.max(len - g, 0.5);
      inner.push({ ...p, i: a.i + 1, visible, offset: pos });
      pos += len;
    }
  }

  const items = [];
  for (const s of segments) {
    items.push(s);
    for (const c of s.children || []) items.push({ ...c, parentKey: s.key });
  }
  const active = items.find((s) => s.key === activeKey) || null;
  const go = (s) => s.href && router.push(s.href);

  // Hovering a sub-part keeps its parent arc lit (not grown, not dimmed).
  const relatedKey = active && active.parentKey ? active.parentKey : null;

  const focusProps = (key) => ({
    onMouseEnter: () => setActiveKey(key),
    onMouseLeave: () => setActiveKey(null),
    onFocus: () => setActiveKey(key),
    onBlur: () => setActiveKey(null),
  });

  const keyGo = (item) => (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      go(item);
    }
  };

  const label = (s) => `${s.label}: ${s.value} of ${total} permits (${percentText(s.value, total)})`;

  const dash = (visible, circ) => ({
    strokeDasharray: `${visible} ${circ - visible}`,
  });

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
              className={`donut-slice${a.key === activeKey ? " is-active" : ""}${
                a.key === relatedKey ? " is-related" : ""
              }`}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={a.color}
              {...dash(a.visible, CIRCUMFERENCE)}
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
              aria-label={label(a)}
              {...focusProps(a.key)}
              onClick={() => go(a)}
              onKeyDown={keyGo(a)}
            />
          ))}
          {inner.map((p) => {
            const inParentFocus = activeKey === p.parentKey;
            return (
              <circle
                key={p.key}
                className={`donut-inner${p.key === activeKey ? " is-active" : ""}${
                  inParentFocus ? " is-related" : ""
                }`}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={INNER_RADIUS}
                fill="none"
                stroke={p.color}
                {...dash(p.visible, INNER_CIRCUMFERENCE)}
                strokeDashoffset={-p.offset}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                style={{
                  "--len": p.visible,
                  "--circ": INNER_CIRCUMFERENCE,
                  "--rest": INNER_CIRCUMFERENCE - p.visible,
                  "--i": p.i,
                }}
                tabIndex={0}
                role="link"
                aria-label={label(p)}
                {...focusProps(p.key)}
                onClick={() => go(p)}
                onKeyDown={keyGo(p)}
              />
            );
          })}
          <g className="donut-center" key={active ? active.key : "total"} pointerEvents="none">
            <text
              x={SIZE / 2}
              y={SIZE / 2 - 2}
              textAnchor="middle"
              className="donut-center__value"
              fill={active ? active.color : "var(--color-ink)"}
            >
              {active ? active.value : centerValue ?? total}
            </text>
            <text x={SIZE / 2} y={SIZE / 2 + 22} textAnchor="middle" className="donut-center__label">
              {active ? active.label : centerLabel}
            </text>
            {active ? (
              <text x={SIZE / 2} y={SIZE / 2 + 40} textAnchor="middle" className="donut-center__pct">
                {percentText(active.value, total)} of all permits
              </text>
            ) : (
              centerSub && (
                <text x={SIZE / 2} y={SIZE / 2 + 40} textAnchor="middle" className="donut-center__pct">
                  {centerSub}
                </text>
              )
            )}
          </g>
        </svg>
      </div>

      <ul className="donut-legend">
        {items.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              className={`donut-legend__row${s.key === activeKey ? " is-active" : ""}${
                s.value === 0 ? " is-empty" : ""
              }`}
              {...focusProps(s.key)}
              onClick={() => go(s)}
            >
              <span className="legend-dot" style={{ background: s.color }} />
              <span className="donut-legend__label">{s.legendLabel || s.label}</span>
              <span className="donut-legend__count">{s.value}</span>
              <span className="donut-legend__pct">{percentText(s.value, total)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
