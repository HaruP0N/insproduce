/** @type {import('next').NextConfig} */
const nextConfig = {
  // Oculta el header que revela que usas Next.js
  poweredByHeader: false,

  turbopack: {},

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Evita que la página se cargue dentro de un iframe (protección contra clickjacking)
          {
            key: "X-Frame-Options",
            value: "DENY",
          },

          // Evita que el navegador adivine tipos de contenido
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },

          // Controla qué información de referencia se envía entre sitios
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },

          // Deshabilita APIs del navegador que no usas
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },

          // Fuerza el uso de HTTPS durante 1 año
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },

          // Protege contra ataques XSS y carga de recursos maliciosos
          {
            key: "Content-Security-Policy",
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval';
              style-src 'self' 'unsafe-inline';
              img-src 'self' data: https:;
              font-src 'self' data:;
              connect-src 'self' https:;
              frame-ancestors 'none';
            `.replace(/\n/g, ""),
          },

          // Evita cache agresivo en páginas dinámicas
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },

          // Evita que el sitio sea embebido en otros contextos
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },

          // Protege recursos contra uso desde otros orígenes
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;