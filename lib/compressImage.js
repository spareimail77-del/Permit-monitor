// Re-saves a photo as a smaller JPEG inside the browser (canvas only, no
// library, nothing goes to the server). Same pixel size unless the longest
// side is over MAX_SIDE, so old phones do not run out of memory.
//
// - The photo's rotation is kept: browsers apply the EXIF orientation when
//   they draw an <img>, so the picture comes out the right way up.
// - Re-saving drops the GPS data and other hidden camera info.
// - Transparent areas (PNG) become white.

export const MAX_SIDE = 4096;
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

// crop (optional) = { x, y, w, h } as fractions (0 to 1) of the picture as it
// looks on screen. The cut is made from the original pixels, then compressed
// once, so a crop costs no extra quality.
// Returns { blob, scaled, width, height }. Throws Error("unreadable") when the browser
// cannot open the picture, or Error("memory") when it cannot process it.
export async function compressToJpeg(file, quality, crop = null) {
  const { img, url } = await loadImage(file);
  try {
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    if (!w0 || !h0) throw new Error("unreadable");

    // The part of the picture to keep, in pixels.
    let sx = 0;
    let sy = 0;
    let sw = w0;
    let sh = h0;
    if (crop) {
      sx = Math.min(w0 - 1, Math.max(0, Math.round(crop.x * w0)));
      sy = Math.min(h0 - 1, Math.max(0, Math.round(crop.y * h0)));
      sw = Math.max(1, Math.min(w0 - sx, Math.round(crop.w * w0)));
      sh = Math.max(1, Math.min(h0 - sy, Math.round(crop.h * h0)));
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

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    canvas.width = 0; // free the memory right away
    canvas.height = 0;
    if (!blob) throw new Error("memory");
    return { blob, scaled: scale < 1, width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}
