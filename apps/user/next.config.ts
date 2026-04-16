import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@knock/ui", "@knock/auth", "@knock/db", "@knock/types", "@knock/utils"],
  experimental: {
    outputFileTracingIncludes: {
      "/**": ["../../packages/db/generated/client/**"],
    },
  },
};

export default nextConfig;
