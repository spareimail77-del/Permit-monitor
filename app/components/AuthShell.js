// Shared wrapper for the sign-in style pages (login, create account, forgot
// password, change password). Background, browser-side only (CSS only, no
// image, no library, no server work):
//   - dark theme: a still, top-down water surface — 4 overlapping domes of
//     colour (like looking straight down at layered ripples), each breathing
//     very slowly, plus 3 thin rings expanding outward from the same point
//     like the rings that spread after something drops into water
//   - light theme: the calm drifting teal haze (unchanged)
// Only one of the two is shown per theme (see .auth-* rules in globals.css).
// All markup below is static (no randomness), so server and client render
// identically. Motion stops with prefers-reduced-motion.

export default function AuthShell({ children, top, below = false }) {
  return (
    <main className={`auth-shell${below ? " auth-shell--below" : ""}`}>
      <div className="auth-bg" aria-hidden="true">
        <div className="auth-waves">
          <span className="ripple-dome ripple-dome--1" />
          <span className="ripple-dome ripple-dome--2" />
          <span className="ripple-dome ripple-dome--3" />
          <span className="ripple-dome ripple-dome--4" />
          <span className="ripple-ring ripple-ring--1" />
          <span className="ripple-ring ripple-ring--2" />
          <span className="ripple-ring ripple-ring--3" />
        </div>
        <span className="auth-blob auth-blob--1" />
        <span className="auth-blob auth-blob--2" />
        <span className="auth-blob auth-blob--3" />
        <span className="auth-vignette" />
      </div>
      {top}
      <div className="auth-center">{children}</div>
    </main>
  );
}
