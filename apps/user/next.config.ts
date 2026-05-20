import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@knock/ui", "@knock/auth", "@knock/types", "@knock/utils"],
  outputFileTracingIncludes: {
    "/**": ["./generated/prisma/*.wasm", "./lib/fonts/**"],
  },
};

export default nextConfig;
