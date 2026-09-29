// Shared wrapper for the sign-in style pages (login, create account, forgot
// password, change password). Background, browser-side only (CSS, no image,
// no library, no server work):
//   - dark theme: ~20 soft fireflies wandering and twinkling
//   - light theme: the calm drifting teal haze
// Only one of the two layers is shown per theme (see .auth-* rules in
// globals.css). Motion stops with prefers-reduced-motion.

// Fixed, hard-coded firefly values from a tiny seeded generator, so server and
// client render exactly the same markup (no Math.random, no hydration mismatch).
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeFireflies(count) {
  const rnd = seeded(20260929);
  const between = (lo, hi) => lo + rnd() * (hi - lo);
  const flies = [];
  while (flies.length < count) {
    const x = between(3, 97);
    const y = between(4, 96);
    // keep most of them off the middle, where the form card sits
    if (Math.abs(x - 50) < 16 && Math.abs(y - 50) < 24 && rnd() < 0.7) continue;
    const style = {
      left: `${x.toFixed(1)}%`,
      top: `${y.toFixed(1)}%`,
      "--dur": `${between(18, 40).toFixed(1)}s`,
      "--delay": `-${between(0, 40).toFixed(1)}s`,
      "--tw": `${between(3.5, 8).toFixed(1)}s`,
      "--twd": `-${between(0, 8).toFixed(1)}s`,
      "--s": `${between(2, 6).toFixed(1)}px`,
    };
    for (let k = 1; k <= 3; k += 1) {
      style[`--x${k}`] = `${between(-22, 22).toFixed(1)}vw`;
      style[`--y${k}`] = `${between(-20, 20).toFixed(1)}vh`;
    }
    // mostly warm yellow-green, a few in the app's violet accent
    const tone = rnd() < 0.22 ? "violet" : rnd() < 0.5 ? "amber" : "green";
    flies.push({ style, tone, extra: flies.length >= 10 });
  }
  return flies;
}

const FIREFLIES = makeFireflies(20);

export default function AuthShell({ children, top, below = false }) {
  return (
    <main className={`auth-shell${below ? " auth-shell--below" : ""}`}>
      <div className="auth-bg" aria-hidden="true">
        <div className="auth-flies">
          {FIREFLIES.map((f, i) => (
            <span
              key={i}
              className={`firefly firefly--${f.tone}${f.extra ? " firefly--extra" : ""}`}
              style={f.style}
            >
              <span className="firefly__dot" />
            </span>
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
