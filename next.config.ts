import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // X profile pictures shown next to verified creator handles.
    remotePatterns: [{ protocol: "https", hostname: "pbs.twimg.com" }],
  },
};

export default nextConfig;
