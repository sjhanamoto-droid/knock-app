import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@knock/ui", "@knock/auth", "@knock/db", "@knock/types", "@knock/utils"],
};

export default nextConfig;
