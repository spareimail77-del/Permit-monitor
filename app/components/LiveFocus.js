"use client";

import { createContext, useContext, useMemo, useState } from "react";

// Tiny shared state that links the "Needs attention" panel and the donut.
// The panel says which status it is showing right now ("OVERDUE" or
// "EXPIRING_SOON"); the donut lights up that slice. Browser-only: nothing
// here talks to the server.
const LiveFocusContext = createContext({ focus: null, setFocus: () => {} });

export default function LiveFocus({ children }) {
  const [focus, setFocus] = useState(null);
  const value = useMemo(() => ({ focus, setFocus }), [focus]);
  return <LiveFocusContext.Provider value={value}>{children}</LiveFocusContext.Provider>;
}

export function useLiveFocus() {
  return useContext(LiveFocusContext);
}
