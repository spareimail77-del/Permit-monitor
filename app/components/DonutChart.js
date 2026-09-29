"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// segments: [{ key, label, value, color, href?, children?: [{ key, label,
//   legendLabel?, value, color, href? }] }]
// Pure SVG + CSS (no chart library). The main ring shows the segments, which
// add up to `total`. A segment may have `children` (a sub-part of that
// segment, e.g. Expiring soon inside Open): they are drawn as a thin inner
// ring that exists only along the parent's arc, and listed under the parent
// in the legend. Hover or keyboard-focus a slice or a legend row and the two
// stay in sync: the slice grows, the others dim and the centre shows that
// item's count and share. Click opens the permit list filtered to it.

const SIZE = 240;
const STROKE = 26;
const STROKE_ACTIVE = 34;
const RADIUS = SIZE / 2 - STROKE_ACTIVE / 2 - 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2.5; // visual gap between slices, in SVG units

// Thin inner "gauge" ring: a faint track along the parent's arc with the
// sub-part filled on top. It sits well inside the main ring, clear of the
// main ring's grown (active) state.
const INNER_STROKE_ACTIVE = 9;
const INNER_RADIUS = RADIUS - STROKE_ACTIVE / 2 - 9 - INNER_STROKE_ACTIVE / 2;
const INNER_CIRCUMFERENCE = 2 * Math.PI * INNER_RADIUS;

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

  // Inner ring pieces: for each parent arc, a faint track over the parent's
  // visible angle, and the children filled on top from its start (each child
  // takes value/parent.value of the track).
  const inner = [];
  for (const a of arcs) {
    if (!a.children || a.children.length === 0) continue;
    const span = (a.visible / CIRCUMFERENCE) * INNER_CIRCUMFERENCE;
    const start = (a.offset / CIRCUMFERENCE) * INNER_CIRCUMFERENCE;
    inner.push({
      key: `${a.key}__track`,
      isTrack: true,
      parentKey: a.key,
      parentHref: a.href,
      color: a.color,
      i: a.i + 1,
      visible: span,
      offset: start,
    });
    let pos = start;
    for (const c of a.children) {
      if (c.value <= 0) continue;
      const len = Math.min(c.value / a.value, 1) * span;
      inner.push({ ...c, parentKey: a.key, i: a.i + 1, visible: Math.max(len, 0.5), offset: pos });
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
            const common = {
              cx: SIZE / 2,
              cy: SIZE / 2,
              r: INNER_RADIUS,
              fill: "none",
              ...dash(p.visible, INNER_CIRCUMFERENCE),
              strokeDashoffset: -p.offset,
              transform: `rotate(-90 ${SIZE / 2} ${SIZE / 2})`,
              style: {
                "--len": p.visible,
                "--circ": INNER_CIRCUMFERENCE,
                "--rest": INNER_CIRCUMFERENCE - p.visible,
                "--i": p.i,
              },
            };
            // The track is decoration belonging to its parent arc: hovering
            // it lights the parent; it is not a separate tab stop.
            if (p.isTrack) {
              const lit = activeKey === p.parentKey || relatedKey === p.parentKey;
              return (
                <circle
                  key={p.key}
                  {...common}
                  className={`donut-inner donut-inner--track${lit ? " is-related" : ""}`}
                  stroke={`color-mix(in srgb, ${p.color} 28%, transparent)`}
                  aria-hidden="true"
                  onMouseEnter={() => setActiveKey(p.parentKey)}
                  onMouseLeave={() => setActiveKey(null)}
                  onClick={() => go({ href: p.parentHref })}
                />
              );
            }
            return (
              <circle
                key={p.key}
                {...common}
                className={`donut-inner${p.key === activeKey ? " is-active" : ""}${
                  activeKey === p.parentKey ? " is-related" : ""
                }`}
                stroke={p.color}
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
        {items.map((s) => {
          const isSub = !!s.parentKey;
          return (
            <li key={s.key}>
              <button
                type="button"
                className={`donut-legend__row${isSub ? " donut-legend__row--sub" : ""}${
                  s.key === activeKey ? " is-active" : ""
                }${s.value === 0 ? " is-empty" : ""}`}
                {...focusProps(s.key)}
                onClick={() => go(s)}
              >
                <span className="legend-dot" style={{ background: s.color }} />
                <span className="donut-legend__label">{s.legendLabel || s.label}</span>
                <span className="donut-legend__count">{s.value}</span>
                <span className="donut-legend__pct">{percentText(s.value, total)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
