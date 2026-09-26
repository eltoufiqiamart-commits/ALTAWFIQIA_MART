/** @type {import('next').NextConfig} */

// Only the project's own Supabase origin may serve images/API traffic.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//, "") ?? "invalid.local";

const isDev = process.env.NODE_ENV !== "production";

// Strict Content-Security-Policy. The app loads no third-party scripts,
// fonts, or trackers: everything is same-origin except the Supabase project.
const csp = [
  "default-src 'self'",
  // Next.js emits inline bootstrap scripts for static/ISR pages (nonces
  // require per-request middleware), so inline scripts are allowed but no
  // external script origin is. 'unsafe-eval' is dev-only (HMR).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
  // Wildcard Supabase origins keep the policy correct even when built before
  // deployment env vars are known; no other third-party host is permitted.
  `connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in https://${supabaseHost}${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  // Type checking and ESLint run as explicit, memory-bounded CI gates:
  //   npm run typecheck   (three split tsc projects — see tsconfig.check-*.json)
  //   npm run lint / lint:admin
  // On small (≈2 GB) build containers a single monolithic tsc pass exhausts
  // the V8 heap; the split projects type-check the same sources in chunks.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    // Only the project's own Supabase project may serve remote images.
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), browsing-topics=(), interest-cohort=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Content-Security-Policy", value: csp },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        // API responses must never be cached by shared caches (user-scoped data).
        // Default-deny: every /api route is no-store unless explicitly listed
        // below as public, non-personalized reference data.
        source: "/api/:path((?!vehicles$|vehicles/).*)",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        // Public vehicle hierarchy only (make/model/engine reference data).
        // Contains no user-specific or private field; safe for the shared CDN.
        // The route handler sets the same value; this keeps it from being
        // overridden by the default-deny rule above.
        source: "/api/vehicles",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
