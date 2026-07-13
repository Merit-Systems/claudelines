import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // X profile pictures shown next to verified creator handles.
    remotePatterns: [{ protocol: "https", hostname: "pbs.twimg.com" }],
  },
  // ImageResponse loads the same JetBrains Mono faces used by browser
  // previews. Explicit tracing keeps pnpm's symlinked font files available in
  // Vercel functions instead of relying on incidental node_modules layout.
  outputFileTracingIncludes: {
    "/statuslines/*/opengraph-image": [
      "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-{400,700}-{normal,italic}.woff",
    ],
    "/statuslines/*/twitter-image": [
      "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-{400,700}-{normal,italic}.woff",
    ],
  },
};

export default nextConfig;
