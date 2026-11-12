import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow YouTube and other common video/image domains
  images: {
    remotePatterns: [
      { hostname: "*.youtube.com", pathname: "/**" },
      { hostname: "ytimg.com", pathname: "/**" },
      { hostname: "*.googleusercontent.com", pathname: "/**" },
      { hostname: "*.githubusercontent.com", pathname: "/**" },
    ],
  },
  // Standalone build for Vercel deployment
  output: "standalone",
  // Enable SWC minify for faster builds
  swcMinify: true,
};

export default nextConfig;
