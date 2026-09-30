import Header from "./Header";

// Placeholder blocks shown by the loading.js files while a page's data loads.
// Server component, no state: shimmer is CSS only (see .skeleton in globals.css).
//   variant "line" (default) - one text line
//   variant "card"           - a stat-card sized block
//   variant "row"            - a table-row sized block
//   variant "block"          - free-size block (pass height)

export default function Skeleton({ variant = "line", width, height, style }) {
  return (
    <span
      className={`skeleton skeleton--${variant}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonLines({ count = 3, lastWidth = "60%" }) {
  return (
    <div className="skeleton-stack">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} width={i === count - 1 ? lastWidth : "100%"} />
      ))}
    </div>
  );
}

export function SkeletonRows({ count = 8 }) {
  return (
    <div className="skeleton-stack">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} variant="row" />
      ))}
    </div>
  );
}

export function SkeletonPanel({ children, style }) {
  return (
    <div className="panel" style={{ padding: "20px 22px", ...style }}>
      {children}
    </div>
  );
}

// Same frame the real pages use: real Header (so the nav doesn't flash) and a
// centred body. Screen readers get one polite "Loading" message.
export function SkeletonPage({ maxWidth = 1200, children }) {
  return (
    <main className="skeleton-page" style={{ minHeight: "100svh" }} aria-busy="true">
      <Header />
      <section style={{ maxWidth, margin: "0 auto", padding: "28px 20px 48px" }}>
        <span className="sr-only" role="status">Loading…</span>
        {children}
      </section>
    </main>
  );
}
