import type { NextConfig } from "next";
import { networkInterfaces } from "os";

// This machine's non-internal IPv4 addresses, so accessing the dev server over the LAN (e.g. from a
// phone/another laptop at http://192.168.x.y:3000) isn't treated as a blocked cross-origin request —
// which otherwise refuses the HMR WebSocket. Computed live, so it follows DHCP / network changes.
const lanOrigins = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => i!.address);

const nextConfig: NextConfig = {
  // @electrace/core is a local package; it's installed as a real copy (see .npmrc
  // install-links=true) so it resolves within the project root without widening the
  // Turbopack workspace root (which would make dev watch the whole parent tree).
  devIndicators: false, // the dev badge would burn into Shorts frames rendered off the dev server
  transpilePackages: ["@electrace/core"],
  allowedDevOrigins: lanOrigins,
  // Baseline security headers (the known-hardening set; full CSP deliberately deferred —
  // Next inline scripts make a strict policy a project of its own).
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      ],
    }];
  },
};

export default nextConfig;
