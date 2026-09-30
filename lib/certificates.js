// Excel cells for "Associated Certificates" (col G) and "Certificate No."
// (col H) often hold several entries in ONE cell, separated by line breaks
// (Alt+Enter) or ; , — HTML collapses line breaks into spaces, which is why
// they showed up as one run-on string. These helpers split them back apart.
//
// Pure functions, no dependencies — safe on server and client.

// Split on line breaks, semicolons and commas. A "/" is NOT a separator
// because names like "MECHANICAL ISOLATION / DE-ISOLATION" use it inside
// a single certificate title.
export function splitCertificates(raw) {
  if (raw == null) return [];
  return String(raw)
    .split(/\r\n|\r|\n|;|,/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

// Fallback for cells where titles were typed with only spaces between them
// ("MECHANICAL ISOLATION / DE-ISOLATION CONFINED SPACE ENTRY ..."). Only
// used when the plain split found ONE entry but there are several numbers.
// Add your site's certificate titles here (longest / most specific first).
export const KNOWN_CERTIFICATE_TITLES = [
  "MECHANICAL ISOLATION / DE-ISOLATION",
  "ELECTRICAL ISOLATION / DE-ISOLATION",
  "CONFINED SPACE ENTRY",
  "ELECTRICAL ISOLATION",
  "MECHANICAL ISOLATION",
  "HOT WORK",
  "COLD WORK",
  "WORKING AT HEIGHT",
  "EXCAVATION",
  "LIFTING",
  "RADIOGRAPHY",
];

function splitByKnownTitles(text) {
  const found = [];
  let rest = text.toUpperCase();
  while (rest.trim()) {
    const t = KNOWN_CERTIFICATE_TITLES.find((k) => rest.trimStart().startsWith(k));
    if (!t) return null; // something unrecognised — don't guess
    found.push(t);
    rest = rest.trimStart().slice(t.length);
  }
  return found;
}

// Certificate numbers get the same split, plus one extra rule: if the cell
// is nothing but digit groups separated by spaces ("825 484 417"), each
// group is its own number. (Only applied when *every* token is numeric, so
// a single reference such as "PTW 2024 001" style text is left alone when
// it contains letters.)
export function splitCertificateNumbers(raw) {
  const parts = splitCertificates(raw);
  if (parts.length === 1 && /^\d+(\s\d+)+$/.test(parts[0])) {
    return parts[0].split(" ");
  }
  return parts;
}

// Pair certificate i with number i when the counts line up. If they don't
// (e.g. 3 certificates but 2 numbers) we can't know which goes with which,
// so pairing is skipped and the UI shows two plain lists instead of
// guessing wrong on a safety document.
export function buildCertificateRows(certificatesRaw, numbersRaw) {
  let names = splitCertificates(certificatesRaw);
  const numbers = splitCertificateNumbers(numbersRaw);
  if (names.length === 1 && numbers.length > 1) {
    const guess = splitByKnownTitles(names[0]);
    if (guess && guess.length === numbers.length) names = guess;
  }
  const paired = names.length > 0 && names.length === numbers.length;
  return {
    names,
    numbers,
    paired,
    rows: paired ? names.map((name, i) => ({ name, number: numbers[i] })) : [],
  };
}
