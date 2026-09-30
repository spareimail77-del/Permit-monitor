"use client";

import { useState } from "react";

// Re-mounts on every navigation, so the quick fade-and-rise (see
// .page-transition in globals.css) plays on every page. Skipped on the one
// dashboard load that follows sign-in: that already has the bigger welcome
// effect (EnterEffect + html[data-enter]).
export default function Template({ children }) {
  const [skip] = useState(
    () => typeof document !== "undefined" && document.documentElement.dataset.enter === "1"
  );
  return (
    <div className={skip ? "page-transition page-transition--off" : "page-transition"}>
      {children}
    </div>
  );
}
