"use client";

import { useEffect } from "react";

// Second half of the sign-in hand-off. LoginForm sets data-enter on <html>
// just before navigating (and SignInLoader covers the screen meanwhile).
// This mounts only once the dashboard's real content has arrived, so it tells
// the loader it can fade away, and keeps the data-enter flag just long enough
// for the cards to rise in (CSS keyed on html[data-enter]), then clears it.
// There is no second curtain any more, which removes the flash between the
// loader and the page. On a normal visit or refresh it does nothing visible.

export default function EnterEffect() {
  useEffect(() => {
    // Harmless when no loader is showing (nothing is listening then).
    window.dispatchEvent(new Event("permit:signin-ready"));
    const root = document.documentElement;
    if (root.dataset.enter !== "1") return undefined;
    const t = setTimeout(() => {
      delete root.dataset.enter;
    }, 1900);
    return () => clearTimeout(t);
  }, []);

  return null;
}
