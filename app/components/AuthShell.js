// Shared wrapper for the sign-in style pages (login, create account, forgot
// password, change password). Background, browser-side only (CSS only, no
// image, no library, no server work):
//   - dark theme: a calm near-black surface with five slow, soft bands of
//     lighter purple light sweeping in from the left edge and corners
//   - light theme: the calm drifting teal haze (unchanged)
// Only one of the two is shown per theme (see .auth-* rules in globals.css).
// All markup below is static (no randomness), so server and client render
// identically. Motion stops with prefers-reduced-motion.

export default function AuthShell({ children, top, below = false }) {
  return (
    <main className={`auth-shell${below ? " auth-shell--below" : ""}`}>
      <div className="auth-bg" aria-hidden="true">
        <div className="auth-waves">
          <span className="wave wave--1" />
          <span className="wave wave--2" />
          <span className="wave wave--3" />
          <span className="wave wave--4" />
          <span className="wave wave--5" />
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
