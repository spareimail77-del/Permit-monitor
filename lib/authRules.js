// Input rules shared by the sign-in, profile and change-password routes (the
// forms show the same limits).

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // Supabase ignores anything longer

// 3 to 12 letters or digits, lower case. Returns null if not valid.
export function cleanStaffId(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9]{3,12}$/.test(v) ? v : null;
}

// 2 to 40 characters, single spaces. Returns null if not valid.
export function cleanName(value) {
  const v = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return v.length >= 2 && v.length <= 40 ? v : null;
}

export function passwordProblem(value) {
  const v = String(value ?? "");
  if (v.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (v.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters.`;
  return null;
}

// Only allow going back to a page on this site after signing in.
export function safeNextPath(value) {
  const v = String(value ?? "");
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/";
}
