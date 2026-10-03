"use client";

import { useEffect, useRef, useState } from "react";
import { quadProblem } from "../../../lib/compressImage";

// Four-corner crop on top of a photo (no library), like a document scanner:
// each corner moves on its own, so a page photographed at an angle can be
// marked exactly and is straightened when you press Apply.
// The corners are stored as fractions of the photo (0 to 1), in this order:
//   [top-left, top-right, bottom-right, bottom-left]
//   - drag a corner to move just that corner (a magnifier shows what is
//     under your finger)
//   - drag inside the shape to move all four together
//   - Tab to a corner, then use the arrow keys (Shift = bigger steps)
// The actual cutting is done by renderToCanvas (lib/compressImage.js).

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round4 = (v) => Math.round(v * 10000) / 10000;

const DEFAULT_QUAD = [
  { x: 0.05, y: 0.05 },
  { x: 0.95, y: 0.05 },
  { x: 0.95, y: 0.95 },
  { x: 0.05, y: 0.95 },
];
const FULL_QUAD = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

const NAMES = ["top-left", "top-right", "bottom-right", "bottom-left"];

function movePoint(pts, i, dx, dy) {
  return pts.map((p, j) =>
    j === i ? { x: clamp(p.x + dx, 0, 1), y: clamp(p.y + dy, 0, 1) } : p
  );
}

function moveAll(pts, dx, dy) {
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const mx = clamp(dx, -minX, 1 - maxX);
  const my = clamp(dy, -minY, 1 - maxY);
  return pts.map((p) => ({ x: p.x + mx, y: p.y + my }));
}

const LOUPE = 104; // magnifier size, px
const ZOOM = 3;

export default function CropEditor({ file, initial, busy = false, error = "", onApply, onCancel }) {
  const imgRef = useRef(null);
  const drag = useRef(null);
  const [url, setUrl] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pts, setPts] = useState(initial || DEFAULT_QUAD);
  const [shown, setShown] = useState({ w: 0, h: 0 }); // photo size on screen, px
  const [nat, setNat] = useState({ w: 0, h: 0 }); // photo size in pixels
  const [active, setActive] = useState(null); // corner being dragged (for the magnifier)

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  // Keep the on-screen size up to date (phone turned, window resized).
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !loaded) return;
    const measure = () => setShown({ w: img.clientWidth, h: img.clientHeight });
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(img);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [loaded]);

  function startDrag(mode) {
    return (e) => {
      if (busy) return;
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { mode, sx: e.clientX, sy: e.clientY, start: pts };
      setActive(mode === "all" ? null : mode);
    };
  }

  function onMove(e) {
    const d = drag.current;
    if (!d || !shown.w || !shown.h) return;
    const dx = (e.clientX - d.sx) / shown.w;
    const dy = (e.clientY - d.sy) / shown.h;
    setPts(d.mode === "all" ? moveAll(d.start, dx, dy) : movePoint(d.start, d.mode, dx, dy));
  }

  function endDrag() {
    drag.current = null;
    setActive(null);
  }

  function onKey(i) {
    return (e) => {
      const step = e.shiftKey ? 0.05 : 0.01;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else return;
      e.preventDefault();
      setPts((b) => movePoint(b, i, dx, dy));
    };
  }

  const problem = loaded && nat.w ? quadProblem(pts, nat.w, nat.h) : null;

  function apply() {
    if (problem || busy) return;
    const whole = pts.every((p, i) => Math.abs(p.x - FULL_QUAD[i].x) < 0.003 && Math.abs(p.y - FULL_QUAD[i].y) < 0.003);
    onApply(whole ? null : pts.map((p) => ({ x: round4(p.x), y: round4(p.y) })));
  }

  const pct = (v) => `${v * 100}%`;
  const polyPoints = pts.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");
  const dimPath = `M0 0H100V100H0Z M${pts.map((p) => `${p.x * 100} ${p.y * 100}`).join(" L")} Z`;

  // Magnifier: shows the photo around the corner being dragged, enlarged.
  let loupe = null;
  if (active !== null && url && shown.w) {
    const p = pts[active];
    loupe = {
      right: p.x < 0.5,
      style: {
        width: LOUPE,
        height: LOUPE,
        backgroundImage: `url(${url})`,
        backgroundSize: `${shown.w * ZOOM}px ${shown.h * ZOOM}px`,
        backgroundPosition: `${LOUPE / 2 - p.x * shown.w * ZOOM}px ${LOUPE / 2 - p.y * shown.h * ZOOM}px`,
      },
    };
  }

  return (
    <div className="crop">
      <p className="crop-help">
        Drag each corner onto a corner of the page. They move one by one, so a page
        photographed at an angle is straightened when you press Apply. Drag inside the
        shape to move all four.
      </p>

      {failed ? (
        <p className="error-text" role="alert">
          This photo can&apos;t be shown for cropping. Cancel and upload it without a crop.
        </p>
      ) : (
        <div className="crop-wrap">
          <div
            className="crop-stage"
            onPointerMove={onMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={url}
                alt="The photo to crop"
                className="crop-img"
                draggable={false}
                onLoad={(e) => {
                  setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
                  setLoaded(true);
                }}
                onError={() => setFailed(true)}
              />
            )}

            {loaded && (
              <>
                <svg
                  className="crop-svg"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d={dimPath} fillRule="evenodd" className="crop-dim" />
                  <polygon points={polyPoints} className="crop-poly-shade" />
                  <polygon
                    points={polyPoints}
                    className={`crop-poly${problem ? " crop-poly--bad" : ""}`}
                    onPointerDown={startDrag("all")}
                  />
                </svg>

                {pts.map((p, i) => (
                  <span
                    key={i}
                    className={`crop-dot${problem ? " crop-dot--bad" : ""}${active === i ? " crop-dot--on" : ""}`}
                    style={{ left: pct(p.x), top: pct(p.y) }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Move the ${NAMES[i]} corner. Arrow keys change it.`}
                    onPointerDown={startDrag(i)}
                    onKeyDown={onKey(i)}
                  />
                ))}

                {loupe && (
                  <span
                    className={`crop-loupe${loupe.right ? " crop-loupe--right" : ""}`}
                    style={loupe.style}
                    aria-hidden="true"
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {problem && (
        <p className="error-text crop-problem" role="alert">
          {problem}
        </p>
      )}
      {error && (
        <p className="error-text crop-problem" role="alert">
          {error}
        </p>
      )}

      <div className="crop-bar">
        <span className="crop-size" aria-live="polite">
          {busy ? "Working…" : ""}
        </span>
        <span className="crop-actions">
          <button type="button" className="btn btn-ghost dz-btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          {!failed && (
            <>
              <button
                type="button"
                className="btn btn-ghost dz-btn"
                onClick={() => setPts(FULL_QUAD)}
                disabled={busy}
              >
                Reset
              </button>
              <button
                type="button"
                className="btn btn-primary dz-btn"
                onClick={apply}
                disabled={!loaded || !!problem || busy}
              >
                {busy ? "Working…" : "Apply"}
              </button>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
