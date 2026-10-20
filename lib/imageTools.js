// Browser-only image helpers for the photo editor: decode, rotate, four-corner
// perspective crop, scan filters and compression. Nothing here touches the network.

export const WORK_MAX = 3000; // longest side of the working copy, in pixels

// Compression levels, lowest first (the editor starts at 0).
export const LEVELS = [
  { name: "Lowest", maxDim: 1280, quality: 0.5 },
  { name: "Low", maxDim: 1600, quality: 0.6 },
  { name: "Medium", maxDim: 2000, quality: 0.72 },
  { name: "High", maxDim: 2600, quality: 0.82 },
  { name: "Best", maxDim: 3000, quality: 0.9 },
];

export const FILTERS = [
  { key: "original", name: "Original" },
  { key: "auto", name: "Auto" },
  { key: "gray", name: "Grayscale" },
  { key: "bw", name: "B&W scan" },
];

// Corners are stored as fractions (0 to 1) of the image: top-left, top-right, bottom-right, bottom-left.
export const defaultCorners = (inset = 0.06) => [
  { x: inset, y: inset },
  { x: 1 - inset, y: inset },
  { x: 1 - inset, y: 1 - inset },
  { x: inset, y: 1 - inset },
];
export const fullCorners = () => defaultCorners(0);

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// Reads the photo (respecting its rotation tag) into a canvas of at most WORK_MAX pixels.
export async function decodeImage(file) {
  let src = null;
  if (typeof createImageBitmap === "function") {
    try {
      src = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      src = null;
    }
  }
  if (!src) {
    src = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("decode failed"));
      };
      img.src = url;
    });
  }
  const w = src.naturalWidth || src.width;
  const h = src.naturalHeight || src.height;
  if (!w || !h) throw new Error("empty image");
  const scale = Math.min(1, WORK_MAX / Math.max(w, h));
  const c = makeCanvas(w * scale, h * scale);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; // transparent PNGs end up on white
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, c.width, c.height);
  if (typeof src.close === "function") src.close();
  return c;
}

// dir 1 = clockwise, -1 = counter-clockwise.
export function rotateCanvas(canvas, dir) {
  const out = makeCanvas(canvas.height, canvas.width);
  const ctx = out.getContext("2d");
  if (dir > 0) {
    ctx.translate(out.width, 0);
    ctx.rotate(Math.PI / 2);
  } else {
    ctx.translate(0, out.height);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.drawImage(canvas, 0, 0);
  return out;
}

// Moves the four corners with the picture when it is rotated.
export function rotateCorners(c, dir) {
  if (dir > 0) {
    const f = (p) => ({ x: 1 - p.y, y: p.x });
    return [f(c[3]), f(c[0]), f(c[1]), f(c[2])];
  }
  const f = (p) => ({ x: p.y, y: 1 - p.x });
  return [f(c[1]), f(c[2]), f(c[3]), f(c[0])];
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// "" when the four corners make a usable convex shape, otherwise a short message.
export function quadProblem(c, W, H) {
  const p = c.map((q) => ({ x: q.x * W, y: q.y * H }));
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = p[i];
    const b = p[(i + 1) % 4];
    const d = p[(i + 2) % 4];
    const cross = (b.x - a.x) * (d.y - b.y) - (b.y - a.y) * (d.x - b.x);
    if (Math.abs(cross) < 1e-6) return "Corners are in a line. Move them apart.";
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return "The corners cross over. Drag them back so the shape has four clear sides.";
  }
  const minSide = Math.min(dist(p[0], p[1]), dist(p[1], p[2]), dist(p[2], p[3]), dist(p[3], p[0]));
  if (minSide < Math.max(24, Math.min(W, H) * 0.04)) return "The crop is too small. Move the corners apart.";
  return "";
}

// Maps the unit square onto a quadrilateral (Heckbert). q = [TL, TR, BR, BL] in pixels.
export function squareToQuad(q) {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  let g = 0;
  let h = 0;
  let a;
  let b;
  let d;
  let e;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    a = p1.x - p0.x;
    b = p2.x - p1.x;
    d = p1.y - p0.y;
    e = p2.y - p1.y;
  } else {
    const det = dx1 * dy2 - dy1 * dx2;
    g = (dx3 * dy2 - dy3 * dx2) / det;
    h = (dx1 * dy3 - dy1 * dx3) / det;
    a = p1.x - p0.x + g * p1.x;
    b = p3.x - p0.x + h * p3.x;
    d = p1.y - p0.y + g * p1.y;
    e = p3.y - p0.y + h * p3.y;
  }
  return { a, b, c: p0.x, d, e, f: p0.y, g, h };
}

// Pure pixel work (easy to test): fills an outW x outH RGBA buffer by sampling the
// quad of the source image with bilinear filtering.
export function warpData(src, srcW, srcH, quad, outW, outH) {
  const m = squareToQuad(quad);
  const out = new Uint8ClampedArray(outW * outH * 4);
  const maxX = srcW - 1;
  const maxY = srcH - 1;
  for (let y = 0; y < outH; y++) {
    const v = (y + 0.5) / outH;
    for (let x = 0; x < outW; x++) {
      const u = (x + 0.5) / outW;
      const den = m.g * u + m.h * v + 1;
      let sx = (m.a * u + m.b * v + m.c) / den - 0.5;
      let sy = (m.d * u + m.e * v + m.f) / den - 0.5;
      sx = sx < 0 ? 0 : sx > maxX ? maxX : sx;
      sy = sy < 0 ? 0 : sy > maxY ? maxY : sy;
      const x0 = sx | 0;
      const y0 = sy | 0;
      const x1 = x0 < maxX ? x0 + 1 : x0;
      const y1 = y0 < maxY ? y0 + 1 : y0;
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * srcW + x0) * 4;
      const i10 = (y0 * srcW + x1) * 4;
      const i01 = (y1 * srcW + x0) * 4;
      const i11 = (y1 * srcW + x1) * 4;
      const o = (y * outW + x) * 4;
      for (let k = 0; k < 3; k++) {
        const top = src[i00 + k] + (src[i10 + k] - src[i00 + k]) * fx;
        const bot = src[i01 + k] + (src[i11 + k] - src[i01 + k]) * fx;
        out[o + k] = top + (bot - top) * fy;
      }
      out[o + 3] = 255;
    }
  }
  return out;
}

// Size of the straightened page, taken from the longer of each pair of opposite sides.
export function quadOutputSize(corners, W, H) {
  const p = corners.map((q) => ({ x: q.x * W, y: q.y * H }));
  let w = Math.max(dist(p[0], p[1]), dist(p[3], p[2]));
  let h = Math.max(dist(p[0], p[3]), dist(p[1], p[2]));
  const scale = Math.min(1, WORK_MAX / Math.max(w, h));
  w = Math.max(16, Math.round(w * scale));
  h = Math.max(16, Math.round(h * scale));
  return { w, h, p };
}

// Cuts the four-corner area out of the canvas and straightens it into a rectangle.
export function cropCanvas(base, corners) {
  const { w, h, p } = quadOutputSize(corners, base.width, base.height);
  const srcCtx = base.getContext("2d");
  const src = srcCtx.getImageData(0, 0, base.width, base.height).data;
  const data = warpData(src, base.width, base.height, p, w, h);
  const out = makeCanvas(w, h);
  out.getContext("2d").putImageData(new ImageData(data, w, h), 0, 0);
  return out;
}

// A new canvas no larger than maxDim on its longer side (never enlarged). Always a copy.
export function resizeTo(canvas, maxDim) {
  const scale = Math.min(1, maxDim / Math.max(canvas.width, canvas.height));
  let cur = canvas;
  let w = canvas.width;
  let h = canvas.height;
  const tw = Math.max(1, Math.round(canvas.width * scale));
  const th = Math.max(1, Math.round(canvas.height * scale));
  // Halve step by step: much sharper than one big jump.
  while (w / 2 > tw && h / 2 > th) {
    w = Math.round(w / 2);
    h = Math.round(h / 2);
    const next = makeCanvas(w, h);
    const ctx = next.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(cur, 0, 0, w, h);
    cur = next;
  }
  const out = makeCanvas(tw, th);
  const ctx = out.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cur, 0, 0, tw, th);
  return out;
}

const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

// Pure filter on an RGBA buffer (easy to test).
export function filterData(d, w, h, kind) {
  if (kind === "original") return d;
  const n = w * h;
  const lum = new Uint8ClampedArray(n);
  const hist = new Uint32Array(256);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const l = (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) | 0;
    lum[i] = l;
    hist[l]++;
  }
  // Brightness range without the extreme 1% on each side.
  let lo = 0;
  let hi = 255;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= n * 0.01) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= n * 0.01) {
      hi = v;
      break;
    }
  }
  if (hi - lo < 24) {
    lo = 0;
    hi = 255;
  }
  const span = hi - lo;
  const stretch = (v) => clamp(((v - lo) * 255) / span, 0, 255);

  if (kind === "auto") {
    for (let p = 0; p < n * 4; p += 4) {
      d[p] = stretch(d[p]);
      d[p + 1] = stretch(d[p + 1]);
      d[p + 2] = stretch(d[p + 2]);
    }
    return d;
  }
  if (kind === "gray") {
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const v = stretch(lum[i]);
      d[p] = d[p + 1] = d[p + 2] = v;
    }
    return d;
  }
  // "bw": estimate the lighting (a very blurry copy), divide it out so shadows and
  // uneven light disappear, then push paper to white and ink to black.
  const sw = Math.max(2, Math.ceil(w / 24));
  const sh = Math.max(2, Math.ceil(h / 24));
  const sum = new Float32Array(sw * sh);
  const cnt = new Float32Array(sw * sh);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(sh - 1, Math.floor((y / h) * sh));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(sw - 1, Math.floor((x / w) * sw));
      const k = sy * sw + sx;
      sum[k] += lum[y * w + x];
      cnt[k]++;
    }
  }
  const bg = new Float32Array(sw * sh);
  for (let k = 0; k < bg.length; k++) bg[k] = cnt[k] ? sum[k] / cnt[k] : 255;
  for (let y = 0; y < h; y++) {
    const fy = clamp((y / h) * sh - 0.5, 0, sh - 1);
    const y0 = fy | 0;
    const y1 = Math.min(sh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = clamp((x / w) * sw - 0.5, 0, sw - 1);
      const x0 = fx | 0;
      const x1 = Math.min(sw - 1, x0 + 1);
      const tx = fx - x0;
      const top = bg[y0 * sw + x0] * (1 - tx) + bg[y0 * sw + x1] * tx;
      const bot = bg[y1 * sw + x0] * (1 - tx) + bg[y1 * sw + x1] * tx;
      const light = Math.max(40, top * (1 - ty) + bot * ty);
      const ratio = lum[y * w + x] / light;
      const v = smooth(0.5, 0.85, ratio) * 255;
      const p = (y * w + x) * 4;
      d[p] = d[p + 1] = d[p + 2] = v;
    }
  }
  return d;
}

export function applyFilter(canvas, kind) {
  if (kind === "original") return canvas;
  const ctx = canvas.getContext("2d");
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  filterData(img.data, canvas.width, canvas.height, kind);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("could not encode"))), "image/jpeg", quality);
  });
}

// Straightened page -> filter -> smaller size -> JPEG. Returns { blob, width, height }.
export async function processForOutput(cropped, level, filter) {
  const out = resizeTo(cropped, level.maxDim);
  applyFilter(out, filter);
  const blob = await canvasToBlob(out, level.quality);
  return { blob, width: out.width, height: out.height };
}
