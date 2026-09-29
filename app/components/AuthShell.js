// Shared wrapper for the sign-in style pages (login, create account, forgot
// password, change password): a slowly drifting "smoke" background made of
// CSS gradients only (no image, no JS, no library), with the form centred on
// top. Colours come from theme variables, so dark = violet smoke and light =
// soft teal haze. Motion stops with prefers-reduced-motion.

export default function AuthShell({ children, top, below = false }) {
  return (
    <main className={`auth-shell${below ? " auth-shell--below" : ""}`}>
      <div className="auth-bg" aria-hidden="true">
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
