import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "./providers";
import "./globals.css";

const notoSansJP = localFont({
  src: [
    { path: "../lib/fonts/NotoSansJP-Regular.ttf", weight: "400", style: "normal" },
    { path: "../lib/fonts/NotoSansJP-Bold.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-noto-sans-jp",
});

export const metadata: Metadata = {
  title: "Knock",
  description: "建設業界向けB2Bマッチングプラットフォーム",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={notoSansJP.variable}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#2563EB" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="bg-[#F4F3F0]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
