import type { Metadata } from "next";
import "./globals.css";
import { NumberInputGuard } from "@/components/number-input-guard";

export const metadata: Metadata = {
  title: "Knock Admin",
  description: "Knock 管理者ダッシュボード",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NumberInputGuard />
        {children}
      </body>
    </html>
  );
}
