// Today's date in Oman time (Asia/Muscat, no daylight saving) as YYYY-MM-DD.
// The server runs in UTC, so this must be worked out explicitly.
export function todayOman() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Muscat",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
