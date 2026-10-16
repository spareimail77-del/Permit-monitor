"use client";

// Prints the page (the print layout hides menus and buttons).
export default function PrintButton() {
  return (
    <button type="button" className="btn btn-sm" onClick={() => window.print()}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 6, verticalAlign: "-2px" }}>
        <path d="M7 9V3h10v6M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2M7 14h10v7H7z" />
      </svg>
      Print
    </button>
  );
}
