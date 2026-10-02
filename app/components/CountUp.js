"use client";

import { useEffect, useState } from "react";

// A number that counts up from 0 when it first appears. Browser-only.
// Reduced-motion users get the final number straight away.
const DURATION_MS = 800;

export default function CountUp({ value }) {
  const target = Number(value);
  const animatable = Number.isFinite(target) && target > 0;
  const [shown, setShown] = useState(animatable ? 0 : value);

  useEffect(() => {
    if (!animatable) {
      setShown(value);
      return undefined;
    }
    const reduce =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(target);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out: fast, then settles
      setShown(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, target, animatable]);

  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{shown}</span>;
}
