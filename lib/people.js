// Linking site accounts to the names used in the Excel log.
//
// The Excel log picks Applicant and Holder from dropdown lists, so the same
// person is always written the same way. An admin links each Excel name to an
// account (Admin -> People & Excel names). Everything below compares names in
// a normalised form: upper case, one space between words.

export const MINE_LABELS = {
  holder: "Holder",
  applicant: "Applicant",
  both: "Holder + Applicant",
};

export function normName(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// A cell normally holds one name. If someone ever types several, these
// separators split them: comma, slash, ampersand, semicolon, new line.
export function splitNames(cell) {
  return String(cell ?? "")
    .split(/[,/&;\n]+/)
    .map(normName)
    .filter(Boolean);
}

// "holder" | "applicant" | "both" | null, for one permit and a set of names.
export function mineRole(permit, nameSet) {
  if (!nameSet || nameSet.size === 0) return null;
  const isHolder = splitNames(permit.holder).some((n) => nameSet.has(n));
  const isApplicant = splitNames(permit.applicant).some((n) => nameSet.has(n));
  if (isHolder && isApplicant) return "both";
  if (isHolder) return "holder";
  if (isApplicant) return "applicant";
  return null;
}

// Every distinct name in the Applicant / Holder columns, with how often each
// appears. Key = normalised name; label = the most common spelling.
export function buildPeopleIndex(permits) {
  const index = new Map();
  function note(cell, field) {
    const raw = String(cell ?? "")
      .split(/[,/&;\n]+/)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    for (const original of raw) {
      const key = normName(original);
      if (!key) continue;
      let e = index.get(key);
      if (!e) {
        e = { key, spellings: new Map(), holderCount: 0, applicantCount: 0 };
        index.set(key, e);
      }
      e.spellings.set(original, (e.spellings.get(original) || 0) + 1);
      e[field] += 1;
    }
  }
  for (const p of permits) {
    note(p.holder, "holderCount");
    note(p.applicant, "applicantCount");
  }
  return [...index.values()].map((e) => ({
    key: e.key,
    label: [...e.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
    holderCount: e.holderCount,
    applicantCount: e.applicantCount,
  }));
}

function editDistance(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n];
}

// Best guess of which account an Excel name belongs to, or null. Only close
// matches count (same name, one or two letters off, or the same words in a
// different order), so a wrong suggestion is unlikely. It is only ever a
// suggestion: an admin has to click it.
export function suggestAccount(excelName, accounts) {
  const target = normName(excelName);
  if (!target) return null;
  const targetWords = new Set(target.split(" "));

  let best = null;
  let tie = false;
  for (const acc of accounts) {
    const name = normName(acc.name);
    if (!name) continue;

    let score = 0;
    if (name === target) {
      score = 1;
    } else {
      const words = new Set(name.split(" "));
      const sameWords =
        words.size === targetWords.size && [...words].every((w) => targetWords.has(w));
      const limit = Math.max(1, Math.floor(Math.min(name.length, target.length) * 0.25));
      if (sameWords) score = 0.95;
      else if (editDistance(name, target) <= limit) score = 0.9;
    }
    if (score === 0) continue;

    if (!best || score > best.score) {
      best = { id: acc.id, label: acc.label, score };
      tie = false;
    } else if (score === best.score) {
      tie = true;
    }
  }
  return best && !tie ? { id: best.id, label: best.label } : null;
}
