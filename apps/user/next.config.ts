import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@knock/ui", "@knock/auth", "@knock/types", "@knock/utils"],
  outputFileTracingIncludes: {
    "/**": ["./generated/prisma/*.wasm", "./lib/fonts/**"],
  },
  experimental: {
    serverActions: {
      // サーバーアクションのボディ上限（デフォルト1MB）。
      // 画像は /api/upload で Vercel Blob に保存し短いURLのみを送るため、
      // 通常この上限に達することはないが、その他のフォーム送信の余裕として引き上げておく。
      // Vercelのリクエストボディ上限(約4.5MB)が物理上限。
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
