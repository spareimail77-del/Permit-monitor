"use client";

import { useEffect, useRef, useState } from "react";

// Simple crop box on top of a photo (no library). The box is stored as
// fractions of the photo (0 to 1), so it does not depend on how big the
// photo is drawn on screen. Mouse, touch and keyboard all work:
//   - drag a corner to resize, drag inside the box to move it
//   - Tab to a corner or the box, then use the arrow keys (Shift = bigger steps)
// The actual cutting is done later by compressToJpeg (lib/compressImage.js).

const MIN_PX = 40; // smallest box side on screen
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round4 = (v) => Math.round(v * 10000) / 10000;

function adjust(mode, s, dx, dy, minW, minH) {
  if (mode === "move") {
    return {
      x: clamp(s.x + dx, 0, 1 - s.w),
      y: clamp(s.y + dy, 0, 1 - s.h),
      w: s.w,
      h: s.h,
    };
  }
  let { x, y, w, h } = s;
  if (mode.includes("w")) {
    const nx = clamp(s.x + dx, 0, s.x + s.w - minW);
    w = s.x + s.w - nx;
    x = nx;
  }
  if (mode.includes("e")) w = clamp(s.w + dx, minW, 1 - s.x);
  if (mode.includes("n")) {
    const ny = clamp(s.y + dy, 0, s.y + s.h - minH);
    h = s.y + s.h - ny;
    y = ny;
  }
  if (mode.includes("s")) h = clamp(s.h + dy, minH, 1 - s.y);
  return { x, y, w, h };
}

const CORNERS = [
  { mode: "nw", label: "top-left" },
  { mode: "ne", label: "top-right" },
  { mode: "sw", label: "bottom-left" },
  { mode: "se", label: "bottom-right" },
];

export default function CropEditor({ file, initial, onApply, onCancel }) {
  const imgRef = useRef(null);
  const drag = useRef(null);
  const [url, setUrl] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [box, setBox] = useState(initial || { x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const [shown, setShown] = useState({ w: 0, h: 0 }); // photo size on screen, px
  const [nat, setNat] = useState({ w: 0, h: 0 }); // photo size in pixels

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

  const minW = shown.w ? Math.min(0.5, MIN_PX / shown.w) : 0.05;
  const minH = shown.h ? Math.min(0.5, MIN_PX / shown.h) : 0.05;

  function startDrag(mode) {
    return (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { mode, sx: e.clientX, sy: e.clientY, start: box };
    };
  }

  function onMove(e) {
    const d = drag.current;
    if (!d || !shown.w || !shown.h) return;
    const dx = (e.clientX - d.sx) / shown.w;
    const dy = (e.clientY - d.sy) / shown.h;
    setBox(adjust(d.mode, d.start, dx, dy, minW, minH));
  }

  function endDrag() {
    drag.current = null;
  }

  function onKey(mode) {
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
      setBox((b) => adjust(mode, b, dx, dy, minW, minH));
    };
  }

  function apply() {
    const whole = box.w > 0.995 && box.h > 0.995;
    onApply(
      whole
        ? null
        : { x: round4(box.x), y: round4(box.y), w: round4(box.w), h: round4(box.h) }
    );
  }

  const pct = (v) => `${v * 100}%`;
  const sizeText = nat.w
    ? `${Math.round(box.w * nat.w)} × ${Math.round(box.h * nat.h)} px`
    : "";

  return (
    <div className="crop">
      <p className="crop-help">
        Drag the corners to choose the part to keep. Drag inside the box to move it.
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
                {/* dim everything outside the box */}
                <div className="crop-dim" style={{ left: 0, top: 0, width: "100%", height: pct(box.y) }} />
                <div className="crop-dim" style={{ left: 0, top: pct(box.y + box.h), width: "100%", height: pct(1 - box.y - box.h) }} />
                <div className="crop-dim" style={{ left: 0, top: pct(box.y), width: pct(box.x), height: pct(box.h) }} />
                <div className="crop-dim" style={{ left: pct(box.x + box.w), top: pct(box.y), width: pct(1 - box.x - box.w), height: pct(box.h) }} />

                <div
                  className="crop-box"
                  style={{ left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h) }}
                  tabIndex={0}
                  role="group"
                  aria-label="Crop box. Arrow keys move it."
                  onPointerDown={startDrag("move")}
                  onKeyDown={onKey("move")}
                >
                  {CORNERS.map((c) => (
                    <span
                      key={c.mode}
                      className={`crop-handle crop-handle--${c.mode}`}
                      tabIndex={0}
                      role="button"
                      aria-label={`Resize crop, ${c.label} corner. Arrow keys change it.`}
                      onPointerDown={startDrag(c.mode)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        onKey(c.mode)(e);
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="crop-bar">
        <span className="crop-size" aria-live="polite">
          {sizeText}
        </span>
        <span className="crop-actions">
          <button type="button" className="btn btn-ghost dz-btn" onClick={onCancel}>
            Cancel
          </button>
          {!failed && (
            <>
              <button
                type="button"
                className="btn btn-ghost dz-btn"
                onClick={() => setBox({ x: 0, y: 0, w: 1, h: 1 })}
              >
                Reset
              </button>
              <button type="button" className="btn btn-primary dz-btn" onClick={apply} disabled={!loaded}>
                Apply
              </button>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
