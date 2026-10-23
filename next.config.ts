import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // the Smart picks route reads its model files from disk, so make sure they ship with it
  outputFileTracingIncludes: { "/api/smartpicks": ["./data/smartpicks/**/*"] },
  partialPrefetching: true,
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
