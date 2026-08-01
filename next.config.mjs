/** @type {import('next').NextConfig} */
// En dev, Next/React Refresh (HMR) requiere 'unsafe-eval'. En producción se omite.
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:;"
  : "script-src 'self' 'unsafe-inline' https:;";

const nextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: `
              default-src 'self';
              ${scriptSrc}
              style-src 'self' 'unsafe-inline' https:;
              img-src 'self' data: blob: https:;
              font-src 'self' data: https:;
              connect-src 'self' https:;
              frame-ancestors 'none';
              base-uri 'self';
              form-action 'self';
            `.replace(/\n/g, ""),
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;