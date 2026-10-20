import type { NextConfig } from "next";
import { parseAllowedOrigins } from "./src/lib/security/origins";

const isProd = process.env.NODE_ENV === "production";
const appOrigins = parseAllowedOrigins(process.env.LUZIA_APP_ALLOWED_ORIGINS, {
  allowLocal: !isProd && process.env.LUZIA_ALLOW_LOCAL_APPS === "true",
});
const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  } catch {
    return "";
  }
})();

// CSP: iframes só para origens aprovadas; o hub não pode ser embutido por terceiros.
// script-src ainda usa 'unsafe-inline' (scripts de hidratação do Next); CSP com nonce fica como melhoria.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin}${isProd ? "" : " ws: http://localhost:*"}`.trim(),
  `frame-src ${appOrigins.length ? appOrigins.join(" ") : "'none'"}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  typedRoutes: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
