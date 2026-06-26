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
      // 完了報告の施工写真など base64 画像を含むサーバーアクションのボディ上限。
      // デフォルト1MBだと画像送信で(Body exceeded 1 MB limit)になるため引き上げる。
      // Vercelのリクエストボディ上限(約4.5MB)が物理上限。これを超える分は
      // クライアント側の圧縮＋合計サイズガードで防ぐ（completion-report-client 参照）。
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
