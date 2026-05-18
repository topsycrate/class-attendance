import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(rootDir),
  poweredByHeader: false,
  serverExternalPackages: ["better-sqlite3"],
  webpack: (config, { isServer }) => {
    if (isServer && config.output) {
      config.output.chunkFilename = "chunks/[name].js";
    }

    return config;
  },
};

export default nextConfig;
