// Photo tools that run inside the browser (canvas only, no library, nothing
// goes to the server):
//   - re-save a photo as a smaller JPEG (compressToJpeg)
//   - cut out the part you marked with four corners and straighten it, like
//     a document scanner (renderToCanvas with a quad)
//
// - The photo's rotation is kept: browsers apply the EXIF orientation when
//   they draw an <img>, so the picture comes out the right way up.
// - Re-saving drops the GPS data and other hidden camera info.
// - Transparent areas (PNG) become white.

export const MAX_SIDE = 4096; // longest side of a normal photo / plain crop
export const WARP_MAX_SIDE = 3500; // longest side when straightening (uses more memory)
export const MAX_IMAGE_INPUT_BYTES = 40 * 1024 * 1024; // refuse bigger photos before decoding

// JPEG quality slider, in percent.
export const QUALITY_MIN = 40;
export const QUALITY_MAX = 95;
export const QUALITY_DEFAULT = 60;

// What kind of file is this? The browser's type wins over the name,
// because iPhones can hand over a converted JPEG that still ends in .HEIC.
export function kindOf(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  if (type === "application/pdf") return "pdf";
  if (type === "image/jpeg" || type === "image/jpg") return "jpeg";
  if (type === "image/png") return "png";
  if (type === "image/heic" || type === "image/heif") return "heic";
  if (name.endsWith(".pdf")) return "pdf";
  if (/\.jpe?g$/.test(name)) return "jpeg";
  if (name.endsWith(".png")) return "png";
  if (/\.hei[cf]$/.test(name)) return "heic";
  return null;
}

export function jpgName(name) {
  const base = String(name || "photo").replace(/\.[^./\\]+$/, "");
  return `${base || "photo"}.jpg`;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    img.src = url;
  });
}

// ---------------------------------------------------------------------
// Four-corner crop. A "quad" is four points as fractions (0 to 1) of the
// photo as it looks on screen, in this order:
//   [top-left, top-right, bottom-right, bottom-left]
// ---------------------------------------------------------------------

// True when the four points are a plain upright rectangle (no straightening needed).
export function isAxisRect(q, eps = 0.002) {
  const [tl, tr, br, bl] = q;
  return (
    Math.abs(tl.y - tr.y) < eps &&
    Math.abs(bl.y - br.y) < eps &&
    Math.abs(tl.x - bl.x) < eps &&
    Math.abs(tr.x - br.x) < eps
  );
}

// Returns a short message when the four corners can't make a sensible
// picture (too close together, crossing over, bending inward), else null.
// nw / nh = the photo's size in pixels, so the maths uses real proportions.
export function quadProblem(q, nw, nh) {
  const p = q.map((pt) => ({ x: pt.x * nw, y: pt.y * nh }));
  const minSide = 0.04 * Math.min(nw, nh);
  for (let i = 0; i < 4; i++) {
    const a = p[i];
    const b = p[(i + 1) % 4];
    if (Math.hypot(a.x - b.x, a.y - b.y) < minSide) {
      return "The corners are too close together.";
    }
  }
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = p[i];
    const b = p[(i + 1) % 4];
    const c = p[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    const s = cross > 0 ? 1 : cross < 0 ? -1 : 0;
    if (s === 0 || (sign !== 0 && s !== sign)) {
      return "The corners cross over or bend inward. Move them so they form a four-sided shape.";
    }
    sign = s;
  }
  return null;
}

// Maps the unit square onto the four points P (pixels). Returns the
// coefficients of  x = (a u + b v + c) / (g u + h v + 1),
//                  y = (d u + e v + f) / (g u + h v + 1).
export function squareToQuad(P) {
  const [p0, p1, p2, p3] = P;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    return {
      a: p1.x - p0.x, b: p2.x - p1.x, c: p0.x,
      d: p1.y - p0.y, e: p2.y - p1.y, f: p0.y,
      g: 0, h: 0,
    };
  }
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const h = (dx1 * dy3 - dx3 * dy1) / den;
  return {
    a: p1.x - p0.x + g * p1.x,
    b: p3.x - p0.x + h * p3.x,
    c: p0.x,
    d: p1.y - p0.y + g * p1.y,
    e: p3.y - p0.y + h * p3.y,
    f: p0.y,
    g,
    h,
  };
}

// Fills od (RGBA, outW x outH) by sampling sd (RGBA, sw x sh) through the
// mapping above, with smooth (bilinear) sampling. Works in bands of rows and
// calls `pause` between bands so the page stays responsive.
export async function warpPixels(sd, sw, sh, P, outW, outH, od, pause) {
  const { a, b, c, d, e, f, g, h } = squareToQuad(P);
  const BAND = 120;
  for (let row0 = 0; row0 < outH; row0 += BAND) {
    const row1 = Math.min(outH, row0 + BAND);
    for (let j = row0; j < row1; j++) {
      const v = (j + 0.5) / outH;
      for (let i = 0; i < outW; i++) {
        const u = (i + 0.5) / outW;
        const den = g * u + h * v + 1;
        let x = (a * u + b * v + c) / den - 0.5;
        let y = (d * u + e * v + f) / den - 0.5;
        if (x < 0) x = 0;
        else if (x > sw - 1) x = sw - 1;
        if (y < 0) y = 0;
        else if (y > sh - 1) y = sh - 1;
        const xa = x | 0;
        const ya = y | 0;
        const xb = xa + 1 < sw ? xa + 1 : xa;
        const yb = ya + 1 < sh ? ya + 1 : ya;
        const fx = x - xa;
        const fy = y - ya;
        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;
        const i00 = (ya * sw + xa) * 4;
        const i10 = (ya * sw + xb) * 4;
        const i01 = (yb * sw + xa) * 4;
        const i11 = (yb * sw + xb) * 4;
        const o = (j * outW + i) * 4;
        od[o] = sd[i00] * w00 + sd[i10] * w10 + sd[i01] * w01 + sd[i11] * w11;
        od[o + 1] = sd[i00 + 1] * w00 + sd[i10 + 1] * w10 + sd[i01 + 1] * w01 + sd[i11 + 1] * w11;
        od[o + 2] = sd[i00 + 2] * w00 + sd[i10 + 2] * w10 + sd[i01 + 2] * w01 + sd[i11 + 2] * w11;
        od[o + 3] = 255;
      }
    }
    if (pause) await pause();
  }
}

const pauseFrame = () => new Promise((resolve) => setTimeout(resolve, 0));

// Draws the photo (or the part marked by `quad`) onto a new canvas.
//  - no quad: the whole photo
//  - an upright rectangle: a plain crop, cut from the original pixels
//  - any other four-sided shape: cut out and straightened into a rectangle
// Returns { canvas, width, height, scaled, perspective }. The caller owns
// the canvas (set its width to 0 when done, to free the memory).
// Throws Error("unreadable") when the browser cannot open the picture, or
// Error("memory") when it cannot process it.
export async function renderToCanvas(file, quad = null) {
  const { img, url } = await loadImage(file);
  try {
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    if (!w0 || !h0) throw new Error("unreadable");

    if (!quad || isAxisRect(quad)) {
      let sx = 0;
      let sy = 0;
      let sw = w0;
      let sh = h0;
      if (quad) {
        const xs = quad.map((p) => p.x);
        const ys = quad.map((p) => p.y);
        const x0 = Math.min(...xs);
        const y0 = Math.min(...ys);
        sx = Math.min(w0 - 1, Math.max(0, Math.round(x0 * w0)));
        sy = Math.min(h0 - 1, Math.max(0, Math.round(y0 * h0)));
        sw = Math.max(1, Math.min(w0 - sx, Math.round((Math.max(...xs) - x0) * w0)));
        sh = Math.max(1, Math.min(h0 - sy, Math.round((Math.max(...ys) - y0) * h0)));
      }
      const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
      const w = Math.max(1, Math.round(sw * scale));
      const h = Math.max(1, Math.round(sh * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("memory");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      return { canvas, width: w, height: h, scaled: scale < 1, perspective: false };
    }

    // Straighten: copy the photo to a (possibly smaller) canvas, read its
    // pixels, then fill the output rectangle pixel by pixel.
    const s0 = Math.min(1, WARP_MAX_SIDE / Math.max(w0, h0));
    const sw0 = Math.max(1, Math.round(w0 * s0));
    const sh0 = Math.max(1, Math.round(h0 * s0));
    const src = document.createElement("canvas");
    src.width = sw0;
    src.height = sh0;
    const sctx = src.getContext("2d", { willReadFrequently: true });
    if (!sctx) throw new Error("memory");
    sctx.fillStyle = "#ffffff";
    sctx.fillRect(0, 0, sw0, sh0);
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(img, 0, 0, sw0, sh0);
    const sd = sctx.getImageData(0, 0, sw0, sh0).data;
    src.width = 0;
    src.height = 0;

    const P = quad.map((p) => ({ x: p.x * sw0, y: p.y * sh0 }));
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    let outW = Math.max(dist(P[0], P[1]), dist(P[3], P[2]));
    let outH = Math.max(dist(P[0], P[3]), dist(P[1], P[2]));
    const k = Math.min(1, WARP_MAX_SIDE / Math.max(outW, outH));
    outW = Math.max(1, Math.round(outW * k));
    outH = Math.max(1, Math.round(outH * k));

    const out = document.createElement("canvas");
    out.width = outW;
    out.height = outH;
    const octx = out.getContext("2d");
    if (!octx) throw new Error("memory");
    const image = octx.createImageData(outW, outH);
    await warpPixels(sd, sw0, sh0, P, outW, outH, image.data, pauseFrame);
    octx.putImageData(image, 0, 0);
    return { canvas: out, width: outW, height: outH, scaled: s0 < 1 || k < 1, perspective: true };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function canvasToJpegBlob(canvas, quality) {
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob) throw new Error("memory");
  return blob;
}

// Whole photo -> smaller JPEG. Returns { blob, scaled, width, height }.
export async function compressToJpeg(file, quality) {
  const { canvas, width, height, scaled } = await renderToCanvas(file);
  try {
    const blob = await canvasToJpegBlob(canvas, quality);
    return { blob, scaled, width, height };
  } finally {
    canvas.width = 0; // free the memory right away
    canvas.height = 0;
  }
}
