"use client";

import { useEffect, useState } from "react";

function clock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

// The bar a guest sees on every page: read only, and how long is left. It counts down from the
// time the server gave (so a wrong clock on the guest's phone does not matter). When it reaches
// zero the guest is taken to the "ended" page. The server and the database enforce the end too.
export default function GuestBanner({ remainingMs }) {
  const [left, setLeft] = useState(remainingMs);

  useEffect(() => {
    const started = performance.now();
    const tick = () => {
      const next = remainingMs - (performance.now() - started);
      setLeft(next);
      if (next <= 0) window.location.href = "/guest/ended";
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [remainingMs]);

  return (
    <div className="guest-banner" role="region" aria-label="Guest view">
      <span className="guest-banner__text">
        <strong>Guest view</strong> · read only
      </span>
      <span className="guest-banner__time" aria-hidden="true">
        Ends in {clock(left)}
      </span>
      <span className="sr-only">Guest view, read only. About {Math.max(1, Math.ceil(left / 60000))} minutes left.</span>
    </div>
  );
}
