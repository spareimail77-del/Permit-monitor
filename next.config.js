/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // The Excel export reads this file from disk, so Vercel must ship it with the function.
    outputFileTracingIncludes: {
      "/api/export": ["./assets/permit-template.xlsx"],
    },
  },
};

module.exports = nextConfig;
