import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import SignInLoader from "./components/SignInLoader";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "Permit Log — SWWS Salalah",
  description: "Work permit monitoring dashboard (read-only)",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a13",
};

// Runs before paint so the correct theme is applied immediately —
// avoids a flash of the wrong theme on load. Reads the same
// localStorage key that ThemeToggle writes to.
const THEME_INIT_SCRIPT = `
(function () {
  var root = document.documentElement;
  try {
    var stored = window.localStorage.getItem("permit-log-theme");
    var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
    function apply() {
      var theme =
        stored === "light" ? "light"
        : stored === "system" ? (mq && mq.matches ? "light" : "dark")
        : "dark";
      root.setAttribute("data-theme", theme);
    }
    apply();
    // "Follow my device": switch live when the phone / PC changes theme.
    if (stored === "system" && mq && mq.addEventListener) {
      mq.addEventListener("change", apply);
    }
  } catch (err) {
    root.setAttribute("data-theme", "dark");
  }
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <SignInLoader />
      </body>
    </html>
  );
}
