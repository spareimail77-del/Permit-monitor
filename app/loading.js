// Shown at once while a page's data is being read, so a click never feels dead.
export default function Loading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="page-loading__bar" aria-hidden="true" />
    </div>
  );
}
