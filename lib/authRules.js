// Input rules shared by the create-account, forgot-password and
// change-password routes (the forms show the same limits).

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // Supabase/bcrypt ignores anything longer

export function cleanStaffId(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9]{3,12}$/.test(v) ? v : null;
}

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
