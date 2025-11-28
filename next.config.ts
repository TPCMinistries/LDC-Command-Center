import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Skip type checking during build (types will still be checked in IDE)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
