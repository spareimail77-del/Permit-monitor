// Shared wrapper for the sign-in style pages (login, create account, forgot
// password, change password). Background, browser-side only (CSS + inline
// SVG, no image, no library, no server work):
//   - dark theme: 4 slow, low-contrast gradient wave bands, layered near the
//     bottom of the screen and drifting sideways at different speeds
//   - light theme: the calm drifting teal haze (unchanged)
// Only one of the two is shown per theme (see .auth-* rules in globals.css).
// All markup below is static (no randomness), so server and client render
// identically. Motion stops with prefers-reduced-motion.

// One base path, 1440 units wide, repeated once so the pair tiles seamlessly
// at 2880 units total. Animating the whole thing left by exactly half its
// width (see the wave-drift keyframes) loops forever with no visible seam.
const WAVE_D =
  "M0,120 C 180,70 360,170 540,120 C 720,70 900,170 1080,120 C 1260,70 1350,150 1440,120" +
  " L1440,220 L0,220 Z" +
  " M1440,120 C 1620,70 1800,170 1980,120 C 2160,70 2340,170 2520,120 C 2700,70 2790,150 2880,120" +
  " L2880,220 L1440,220 Z";

const WAVES = [
  { tone: "1", dur: "34s", delay: "0s", opacity: 0.16 },
  { tone: "2", dur: "46s", delay: "-14s", opacity: 0.14 },
  { tone: "3", dur: "58s", delay: "-30s", opacity: 0.12 },
  { tone: "4", dur: "70s", delay: "-6s", opacity: 0.1 },
];

export default function AuthShell({ children, top, below = false }) {
  return (
    <main className={`auth-shell${below ? " auth-shell--below" : ""}`}>
      <div className="auth-bg" aria-hidden="true">
        <div className="auth-waves">
          {WAVES.map((w, i) => (
            <svg
              key={i}
              className={`wave wave--${w.tone}`}
              viewBox="0 0 2880 220"
              preserveAspectRatio="none"
              style={{ "--wave-dur": w.dur, "--wave-delay": w.delay, opacity: w.opacity }}
            >
              <path d={WAVE_D} />
            </svg>
          ))}
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
