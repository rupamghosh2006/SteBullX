import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Keep file tracing inside this repository; desktop environments may have
  // unrelated lockfiles or inaccessible parent directories.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
