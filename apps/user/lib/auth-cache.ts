import { cache } from "react";
import { auth } from "@/auth";

/**
 * リクエストスコープで共有される auth() のキャッシュ。
 * session.ts / mode-server.ts など複数箇所から呼ばれても、
 * 1リクエスト内では auth()（JWT検証・DBフォールバック）が一度しか走らない。
 */
export const getCachedAuth = cache(() => auth());
