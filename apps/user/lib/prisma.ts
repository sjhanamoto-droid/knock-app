import { PrismaClient } from "@/generated/prisma";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// サーバーレスのウォームインスタンス間で同一クライアント（=同一コネクションプール）を
// 再利用し、リクエストごとの再接続を防ぐ。本番でも必ず保持する。
globalForPrisma.prisma = prisma;
