"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_FILE_BYTES, fileProblem, formatBytes } from "../../lib/fileRules";
import {
  FILTERS,
  LEVELS,
  cropCanvas,
  decodeImage,
  defaultCorners,
  fullCorners,
  processForOutput,
  quadProblem,
  rotateCanvas,
  rotateCorners,
} from "../../lib/imageTools";

// Photo editor that opens when a picture is chosen for upload.
//   Step 1  Crop: four free corners (like a document scanner), a magnifier while dragging,
//           rotate, reset.
//   Step 2  Compress: filter, a compression slider that starts at the lowest level,
//           the real result shown with its size, and a full screen view.
// Nothing is uploaded here: onDone(file) hands the finished picture back, onDone(null) = cancelled.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const PAD = 14;
const LOUPE = 124;
const ZOOM = 3;
const CORNER_NAMES = ["Top left corner", "Top right corner", "Bottom right corner", "Bottom left corner"];
const EDGE_NAMES = ["Top side", "Right side", "Bottom side", "Left side"];

const Icon = ({ d, size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICONS = {
  close: "M6 6l12 12M18 6L6 18",
  rotR: "M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5",
  rotL: "M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5",
  reset: "M4 4v6h6M4.5 14a8 8 0 1 0 2-8.5L4 10",
  full: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  expand: "M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7",
  check: "M5 12.5l4.5 4.5L19 7.5",
  back: "M15 5l-7 7 7 7",
  next: "M9 5l7 7-7 7",
};

export default function ImageEditor({ file, onDone }) {
  const [phase, setPhase] = useState("loading"); // loading | ready
  const [base, setBase] = useState(null); // working picture (canvas)
  const [corners, setCorners] = useState(defaultCorners());
  const [step, setStep] = useState("crop"); // crop | adjust
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [active, setActive] = useState(null); // { kind: "corner" | "edge", index }
  const [level, setLevel] = useState(0); // starts at the lowest compression
  const [filter, setFilter] = useState("original");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { blob, url, width, height }
  const [problemText, setProblemText] = useState("");
  const [fullOpen, setFullOpen] = useState(false);

  const dialogRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const loupeRef = useRef(null);
  const drag = useRef(null);
  const croppedRef = useRef(null);
  const [croppedAt, setCroppedAt] = useState(0);
  const token = useRef(0);
  const urlRef = useRef(null);
  const fullOpenRef = useRef(false);
  fullOpenRef.current = fullOpen;

  // ---- load the picture ----
  useEffect(() => {
    let dead = false;
    decodeImage(file)
      .then((c) => {
        if (dead) return;
        setBase(c);
        setPhase("ready");
      })
      .catch(() => {
        // Could not read it as a picture: let the normal file checks deal with the original.
        if (!dead) onDone(file);
      });
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Lock page scroll while open; free the preview URL when closed.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  // ---- measure the crop area ----
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase, step]);

  const scale = useMemo(() => {
    if (!base || !box.w || !box.h) return 0;
    return Math.min((box.w - PAD * 2) / base.width, (box.h - PAD * 2) / base.height);
  }, [base, box]);
  const dw = base ? Math.max(1, Math.floor(base.width * scale)) : 0;
  const dh = base ? Math.max(1, Math.floor(base.height * scale)) : 0;

  // ---- draw the picture in the crop area ----
  useEffect(() => {
    if (step !== "crop" || !base || !canvasRef.current || !dw) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = canvasRef.current;
    c.width = Math.round(dw * dpr);
    c.height = Math.round(dh * dpr);
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(base, 0, 0, c.width, c.height);
  }, [step, base, dw, dh]);

  // ---- magnifier ----
  useEffect(() => {
    const c = loupeRef.current;
    if (!c || !active || active.kind !== "corner" || !base || !scale) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = LOUPE * dpr;
    c.height = LOUPE * dpr;
    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    const p = corners[active.index];
    const cx = p.x * base.width;
    const cy = p.y * base.height;
    const srcSize = LOUPE / (scale * ZOOM);
    ctx.fillStyle = "#0b1117";
    ctx.fillRect(0, 0, LOUPE, LOUPE);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(base, cx - srcSize / 2, cy - srcSize / 2, srcSize, srcSize, 0, 0, LOUPE, LOUPE);
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(LOUPE / 2, 0);
    ctx.lineTo(LOUPE / 2, LOUPE);
    ctx.moveTo(0, LOUPE / 2);
    ctx.lineTo(LOUPE, LOUPE / 2);
    ctx.stroke();
    ctx.strokeStyle = "#2dd4bf";
    ctx.beginPath();
    ctx.arc(LOUPE / 2, LOUPE / 2, 7, 0, Math.PI * 2);
    ctx.stroke();
  }, [active, corners, base, scale]);

  const problem = base ? quadProblem(corners, base.width, base.height) : "";
  const pts = corners.map((c) => ({ x: c.x * dw, y: c.y * dh }));

  // ---- dragging ----
  function startDrag(e, kind, index) {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { kind, index, x: e.clientX, y: e.clientY, start: corners.map((c) => ({ ...c })) };
    setActive({ kind, index });
  }
  function moveDrag(e) {
    const d = drag.current;
    if (!d || !dw) return;
    const dx = (e.clientX - d.x) / dw;
    const dy = (e.clientY - d.y) / dh;
    if (d.kind === "corner") {
      const s = d.start[d.index];
      setCorners((cs) => cs.map((c, i) => (i === d.index ? { x: clamp01(s.x + dx), y: clamp01(s.y + dy) } : c)));
    } else {
      const i = d.index;
      const j = (i + 1) % 4;
      const minX = Math.min(d.start[i].x, d.start[j].x);
      const maxX = Math.max(d.start[i].x, d.start[j].x);
      const minY = Math.min(d.start[i].y, d.start[j].y);
      const maxY = Math.max(d.start[i].y, d.start[j].y);
      const cdx = Math.max(-minX, Math.min(1 - maxX, dx));
      const cdy = Math.max(-minY, Math.min(1 - maxY, dy));
      setCorners((cs) => cs.map((c, k) => (k === i || k === j ? { x: d.start[k].x + cdx, y: d.start[k].y + cdy } : c)));
    }
  }
  function endDrag() {
    drag.current = null;
    setActive(null);
  }
  function keyMove(e, kind, index) {
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const a = arrows[e.key];
    if (!a || !dw) return;
    e.preventDefault();
    const step = (e.shiftKey ? 12 : 2) / Math.max(dw, dh);
    const move = (c) => ({ x: clamp01(c.x + a[0] * step), y: clamp01(c.y + a[1] * step) });
    setCorners((cs) => {
      const ids = kind === "corner" ? [index] : [index, (index + 1) % 4];
      return cs.map((c, i) => (ids.includes(i) ? move(c) : c));
    });
  }

  // ---- rotate / reset ----
  function rotate(dir) {
    if (!base) return;
    setBase(rotateCanvas(base, dir));
    setCorners((c) => rotateCorners(c, dir));
  }

  // ---- step 2: straighten once, then compress on demand ----
  useEffect(() => {
    if (step !== "adjust" || !base) return undefined;
    let dead = false;
    setBusy(true);
    setProblemText("");
    const t = setTimeout(() => {
      if (dead) return;
      try {
        croppedRef.current = cropCanvas(base, corners);
        setCroppedAt(Date.now());
      } catch {
        setProblemText("Could not process this photo. Go back and try again.");
        setBusy(false);
      }
    }, 40);
    return () => {
      dead = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (step !== "adjust" || !croppedRef.current) return undefined;
    const mine = ++token.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await processForOutput(croppedRef.current, LEVELS[level], filter);
        if (mine !== token.current) return;
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const url = URL.createObjectURL(r.blob);
        urlRef.current = url;
        setResult({ ...r, url });
        setProblemText("");
      } catch {
        if (mine === token.current) setProblemText("Could not process this photo. Try another level or go back.");
      } finally {
        if (mine === token.current) setBusy(false);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [step, croppedAt, level, filter]);

  const tooBig = result && result.blob.size > MAX_FILE_BYTES;
  const originalOk = !fileProblem(file);

  function finish() {
    if (!result || tooBig) return;
    const base0 = file.name.replace(/\.[^.]+$/, "") || "photo";
    onDone(new File([result.blob], `${base0}.jpg`, { type: "image/jpeg", lastModified: Date.now() }));
  }

  // ---- keyboard: Escape closes, Tab stays inside ----
  useEffect(() => {
    const onKey = (e) => {
      if (fullOpenRef.current) return; // the full screen view handles its own keys
      if (e.key === "Escape") {
        e.preventDefault();
        onDone(null);
      }
      if (e.key === "Tab" && dialogRef.current) {
        const f = [...dialogRef.current.querySelectorAll("button:not([disabled]), [tabindex='0'], input:not([disabled])")].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDone]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const saved = result && file.size > 0 ? Math.round((1 - result.blob.size / file.size) * 100) : 0;
  const loupeOnRight = active && active.kind === "corner" && pts[active.index] && pts[active.index].x < LOUPE + 40 && pts[active.index].y < LOUPE + 40;

  return (
    <div className="ie-backdrop">
      <div className="ie" role="dialog" aria-modal="true" aria-labelledby="ie-title" ref={dialogRef} tabIndex={-1}>
        <header className="ie-head">
          <div>
            <h2 id="ie-title" className="ie-title">
              {step === "crop" ? "Crop photo" : "Adjust and compress"}
            </h2>
            <ol className="ie-steps" aria-label="Steps">
              <li className={step === "crop" ? "is-on" : "is-done"}>
                <span>1</span> Crop
              </li>
              <li className={step === "adjust" ? "is-on" : ""}>
                <span>2</span> Compress
              </li>
            </ol>
          </div>
          <button type="button" className="ie-x" onClick={() => onDone(null)} aria-label="Cancel and close">
            <Icon d={ICONS.close} />
          </button>
        </header>

        {phase === "loading" ? (
          <div className="ie-center" role="status">
            <span className="ie-spin" aria-hidden="true" />
            Opening photo…
          </div>
        ) : step === "crop" ? (
          <>
            <div className="ie-stage" ref={stageRef}>
              {dw > 0 && (
                <div className="ie-frame" style={{ width: dw, height: dh }}>
                  <canvas ref={canvasRef} className="ie-canvas" style={{ width: dw, height: dh }} />
                  <svg className="ie-svg" width={dw} height={dh} viewBox={`0 0 ${dw} ${dh}`} aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      className="ie-shade"
                      d={`M0 0H${dw}V${dh}H0Z M${pts.map((p) => `${p.x} ${p.y}`).join(" L")}Z`}
                    />
                    <polygon className={`ie-quad${problem ? " is-bad" : ""}`} points={pts.map((p) => `${p.x},${p.y}`).join(" ")} />
                  </svg>

                  {pts.map((p, i) => {
                    const q = pts[(i + 1) % 4];
                    return (
                      <div
                        key={`e${i}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`${EDGE_NAMES[i]}: drag to move, or use arrow keys`}
                        className={`ie-h ie-h--edge${active?.kind === "edge" && active.index === i ? " is-active" : ""}`}
                        style={{ left: (p.x + q.x) / 2, top: (p.y + q.y) / 2 }}
                        onPointerDown={(e) => startDrag(e, "edge", i)}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        onKeyDown={(e) => keyMove(e, "edge", i)}
                      >
                        <span />
                      </div>
                    );
                  })}
                  {pts.map((p, i) => (
                    <div
                      key={`c${i}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${CORNER_NAMES[i]}: drag to move, or use arrow keys`}
                      className={`ie-h ie-h--corner${active?.kind === "corner" && active.index === i ? " is-active" : ""}${problem ? " is-bad" : ""}`}
                      style={{ left: p.x, top: p.y }}
                      onPointerDown={(e) => startDrag(e, "corner", i)}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      onKeyDown={(e) => keyMove(e, "corner", i)}
                    >
                      <span />
                    </div>
                  ))}

                  {active?.kind === "corner" && (
                    <canvas ref={loupeRef} className="ie-loupe" style={{ width: LOUPE, height: LOUPE, ...(loupeOnRight ? { right: 8 } : { left: 8 }), top: 8 }} aria-hidden="true" />
                  )}
                </div>
              )}
            </div>

            <div className="ie-tools">
              <button type="button" className="ie-tool" onClick={() => rotate(-1)}>
                <Icon d={ICONS.rotL} /> Rotate left
              </button>
              <button type="button" className="ie-tool" onClick={() => rotate(1)}>
                <Icon d={ICONS.rotR} /> Rotate right
              </button>
              <button type="button" className="ie-tool" onClick={() => setCorners(fullCorners())}>
                <Icon d={ICONS.full} /> Full photo
              </button>
              <button type="button" className="ie-tool" onClick={() => setCorners(defaultCorners())}>
                <Icon d={ICONS.reset} /> Reset
              </button>
            </div>
            <p className={`ie-hint${problem ? " is-bad" : ""}`} role={problem ? "alert" : undefined}>
              {problem || "Drag the four corners onto the corners of the paper. Drag a dot on a side to move that side."}
            </p>

            <footer className="ie-foot">
              <button type="button" className="btn" onClick={() => onDone(null)}>
                Cancel
              </button>
              <span className="ie-foot__gap" />
              {originalOk && (
                <button type="button" className="btn" onClick={() => onDone(file)} title="Upload the photo as it is, without cropping or compressing">
                  Use original
                </button>
              )}
              <button type="button" className="btn btn-primary" disabled={Boolean(problem)} onClick={() => setStep("adjust")}>
                Next <Icon d={ICONS.next} size={16} />
              </button>
            </footer>
          </>
        ) : (
          <>
            <div className="ie-adjust">
              <div className="ie-preview">
                {result ? (
                  <button type="button" className="ie-preview__btn" onClick={() => setFullOpen(true)} aria-label="View the photo full screen">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={result.url} alt="Preview of the cropped photo" className={busy ? "is-busy" : ""} />
                  </button>
                ) : null}
                {busy && (
                  <div className="ie-center ie-center--over" role="status">
                    <span className="ie-spin" aria-hidden="true" />
                    Working…
                  </div>
                )}
                {result && (
                  <button type="button" className="ie-fsbtn" onClick={() => setFullOpen(true)}>
                    <Icon d={ICONS.expand} size={16} /> Full screen
                  </button>
                )}
              </div>

              <div className="ie-panel">
                <section>
                  <h3 className="ie-h3">Look</h3>
                  <div className="ie-chips" role="group" aria-label="Filter">
                    {FILTERS.map((f) => (
                      <button key={f.key} type="button" className={`ie-chip${filter === f.key ? " is-on" : ""}`} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                        {f.name}
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <div className="ie-row">
                    <h3 className="ie-h3">
                      <label htmlFor="ie-level">Compression</label>
                    </h3>
                    <strong className="ie-level">
                      {LEVELS[level].name}
                      {level === 0 ? " (default)" : ""}
                    </strong>
                  </div>
                  <input
                    id="ie-level"
                    className="ie-range"
                    type="range"
                    min={0}
                    max={LEVELS.length - 1}
                    step={1}
                    value={level}
                    onChange={(e) => setLevel(Number(e.target.value))}
                    aria-valuetext={`${LEVELS[level].name} compression`}
                    style={{ "--p": `${(level / (LEVELS.length - 1)) * 100}%` }}
                  />
                  <div className="ie-ticks" aria-hidden="true">
                    <span>Smallest file</span>
                    <span>Sharpest</span>
                  </div>
                  <p className="ie-note">Check small text in full screen. If it is hard to read, move the slider to the right.</p>
                </section>

                <section className="ie-stats" aria-live="polite">
                  <div>
                    <span>Original</span>
                    <strong>{formatBytes(file.size)}</strong>
                  </div>
                  <div>
                    <span>New file</span>
                    <strong>{result ? formatBytes(result.blob.size) : "…"}</strong>
                  </div>
                  <div>
                    <span>{saved >= 0 ? "Saved" : "Larger by"}</span>
                    <strong>{result ? `${Math.abs(saved)}%` : "…"}</strong>
                  </div>
                  <div>
                    <span>Size</span>
                    <strong>{result ? `${result.width}×${result.height}` : "…"}</strong>
                  </div>
                </section>

                {tooBig && <p className="ie-hint is-bad">Still over 10 MB. Move the slider to the left.</p>}
                {problemText && <p className="ie-hint is-bad">{problemText}</p>}
              </div>
            </div>

            <footer className="ie-foot">
              <button type="button" className="btn" onClick={() => setStep("crop")}>
                <Icon d={ICONS.back} size={16} /> Back
              </button>
              <span className="ie-foot__gap" />
              <button type="button" className="btn btn-primary" disabled={busy || !result || tooBig} onClick={finish}>
                <Icon d={ICONS.check} size={16} /> Use this photo
              </button>
            </footer>
          </>
        )}
      </div>

      {fullOpen && result && <FullView result={result} size={result.blob.size} onClose={() => setFullOpen(false)} />}
    </div>
  );
}

// The finished photo at full screen: Fit, or 100% (real pixels) and scroll around.
function FullView({ result, size, onClose }) {
  const [zoom, setZoom] = useState("fit"); // fit | real
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="ie-full" role="dialog" aria-modal="true" aria-label="Photo full screen">
      <div className="ie-full__bar">
        <span className="ie-full__info">
          {result.width}×{result.height} · {formatBytes(size)}
        </span>
        <div className="ie-full__btns">
          <button type="button" className={`ie-chip${zoom === "fit" ? " is-on" : ""}`} onClick={() => setZoom("fit")}>
            Fit
          </button>
          <button type="button" className={`ie-chip${zoom === "real" ? " is-on" : ""}`} onClick={() => setZoom("real")}>
            100%
          </button>
          <button ref={closeRef} type="button" className="ie-x" onClick={onClose} aria-label="Close full screen">
            <Icon d={ICONS.close} />
          </button>
        </div>
      </div>
      <div className={`ie-full__body${zoom === "real" ? " is-real" : ""}`} onClick={() => setZoom((z) => (z === "fit" ? "real" : "fit"))}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={result.url}
          alt="Cropped photo, full screen"
          draggable={false}
          style={zoom === "real" ? { width: result.width / Math.max(1, Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1)), maxWidth: "none" } : undefined}
        />
      </div>
      <p className="ie-full__hint">Tap the photo to switch between Fit and 100%.</p>
    </div>
  );
}
