import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["antitoxic-nutmeg-ranting.ngrok-free.dev"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;