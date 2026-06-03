import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @electrace/core is a local package; it's installed as a real copy (see .npmrc
  // install-links=true) so it resolves within the project root without widening the
  // Turbopack workspace root (which would make dev watch the whole parent tree).
  transpilePackages: ["@electrace/core"],
};

export default nextConfig;
