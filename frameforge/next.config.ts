import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Ensure images are optimized or handled correctly if used
  images: {
    unoptimized: true, // Since it's a client-side tool, we don't need server-side image optimization
  },
  // Vercel handles the build process, but we can enforce strict typing for safer deploys
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
