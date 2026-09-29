"use client";

import { useEffect, useState } from "react";

// Second half of the sign-in transition. LoginForm sets data-enter on <html>
// just before navigating. Here (dashboard only) we show a curtain that fades
// out over the page while cards rise in (CSS keyed on html[data-enter]), then
// clear the flag. On a normal visit or refresh nothing happens.

export default function EnterEffect() {
  const [show, setShow] = useState(
    () => typeof document !== "undefined" && document.documentElement.dataset.enter === "1"
  );

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.enter !== "1") return undefined;
    const t1 = setTimeout(() => setShow(false), 800);
    const t2 = setTimeout(() => {
      delete root.dataset.enter;
    }, 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return show ? <div className="veil veil--out" aria-hidden="true" /> : null;
}
