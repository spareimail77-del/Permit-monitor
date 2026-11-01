// Matching for the Location picker. Pure functions, no database, runs in the browser
// (and on the server for the duplicate check), so typing costs no requests.

// "MPS - 01", "mps1", "Mps -1", "mps  1" all become "MPS1": letters and numbers only,
// upper case, leading zeros of a number dropped. Words in any language are kept.
export function locKey(text) {
  const parts = String(text ?? "").toUpperCase().match(/\p{L}+|\p{N}+/gu) || [];
  return parts.map((p) => (/^\p{N}+$/u.test(p) ? p.replace(/^0+(?=.)/, "") : p)).join("");
}

// Edit distance that counts a swapped pair of letters ("MSP" -> "MPS") as ONE mistake.
function distance(a, b) {
  const al = a.length;
  const bl = b.length;
  if (!al) return bl;
  if (!bl) return al;
  const d = Array.from({ length: al + 1 }, (_, i) => [i, ...Array(bl).fill(0)]);
  for (let j = 0; j <= bl; j++) d[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[al][bl];
}

// How well does what was typed fit one location? 0 = not at all, bigger = better.
export function matchScore(typed, location) {
  const q = locKey(typed);
  const c = locKey(location);
  if (!q || !c) return 0;
  if (q === c) return 1000;
  if (c.startsWith(q)) return 800 - (c.length - q.length);
  const at = c.indexOf(q);
  if (at > 0) return 600 - at;
  // Small typing mistakes: compare with the same-length start of the location too, so a
  // half-typed, slightly wrong word ("msp") still finds "MPS1".
  const allowed = q.length <= 2 ? 0 : q.length <= 5 ? 1 : 2;
  if (!allowed) return 0;
  const whole = distance(q, c);
  let best = whole;
  for (let len = Math.max(1, q.length - 1); len <= Math.min(c.length, q.length + 1); len++) {
    best = Math.min(best, distance(q, c.slice(0, len)));
  }
  return best <= allowed ? 400 - best * 50 - whole : 0;
}

const natural = (a, b) => String(a).localeCompare(String(b), "en", { numeric: true, sensitivity: "base" });

// The chips to show: best match first. Nothing typed -> every location in natural order
// (MPS - 2 before MPS - 10). `chosen` ones are left out.
export function suggest(typed, locations, chosen = [], limit = 24) {
  const taken = new Set(chosen.map(locKey));
  const free = locations.filter((l) => !taken.has(locKey(l)));
  if (!locKey(typed)) return free.sort(natural).slice(0, limit);
  return free
    .map((l) => ({ l, s: matchScore(typed, l) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || natural(a.l, b.l))
    .slice(0, limit)
    .map((x) => x.l);
}

// ["A"] -> "A", ["A","B"] -> "A & B", ["A","B","C"] -> "A, B & C"
export function joinLocations(list) {
  const l = (list || []).map((x) => String(x).trim()).filter(Boolean);
  if (l.length <= 1) return l.join("");
  return `${l.slice(0, -1).join(", ")} & ${l[l.length - 1]}`;
}

// Turns saved text back into picked locations, but ONLY when every part is a listed
// location and joining them gives exactly the same text. Otherwise null (an old,
// free-typed location is kept as it is).
export function parseLocations(text, locations) {
  const t = String(text ?? "").trim();
  if (!t) return [];
  const byValue = new Map(locations.map((l) => [String(l).trim().toUpperCase(), l]));
  if (byValue.has(t.toUpperCase())) return [byValue.get(t.toUpperCase())];
  const parts = t.split(/\s*(?:,|&)\s*/).filter(Boolean);
  const found = parts.map((p) => byValue.get(p.trim().toUpperCase()));
  if (found.some((x) => !x)) return null;
  return joinLocations(found) === t ? found : null;
}
