import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // 末尾の画像拡張子(png/jpg/svg等)を除外しないと、public直下の画像(knock-logo.png等)が
  // 未認証ページ(ログイン/パスワード再設定など)で認証ミドルウェアに捕まって /login へ
  // リダイレクトされ、next/image の最適化が失敗する(ロゴが読み込めない)。
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|icons/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
