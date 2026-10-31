import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Image uploads go through a server action. Vercel itself rejects bodies above 4.5 MB.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  async headers() {
    // Private areas are never meant for search results, even if a link to them leaks.
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      ...["/app/:path*", "/admin/:path*", "/api/:path*", "/auth/:path*", "/onboarding/:path*", "/checkout/:path*"].map((source) => ({ source, headers: noindex })),
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          // Only directives that cannot break the app: no framing, no <base> tricks, no plugins.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
