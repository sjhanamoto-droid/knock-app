/**
 * 出来高（部分完了）テスト用データ生成スクリプト（山田建設[発注者] ↔ 田中塗装/鈴木電気[受注者]）
 *
 * 実行（apps/user で）:
 *   set -a; . ./.env; set +a
 *   ../../packages/db/node_modules/.bin/tsx scripts/seed-progress-test.ts
 *
 * 生成物（すべて id が "seedpg-" 始まり = 再実行時に洗い替え。出来高・通知も削除）:
 *  ※注文書・注文請書はアプリの発行処理(generateOrderSheet)で作成するため、apps/user で実行すること。
 *  A. 田中塗装「横浜市 T様邸 外壁改修」> 外壁塗装工事
 *     - 発注書1 ¥1,000,000（税抜） / 追加工事 ¥45,000（税抜）… どちらも施工中・出来高なし
 *     → 受注者(tanaka)で 40万→確定→残り60万→確定で完了 / 差し戻し→再送信 / 残額超えエラー を試す
 *  B. 鈴木電気「港北倉庫 照明改修工事」発注書 ¥800,000（税抜）
 *     - 出来高[10月分] ¥300,000 を 2026/10/31 15:20 に申請済み・確定待ち
 *     → 発注者(yamada)が今月確定しても「10月分」の請求候補になることを試す
 */
import { PrismaClient } from "../generated/prisma/index.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const ORDERER = "test-company-yamada-kensetsu"; // 山田建設（株）= 発注者
const YAMADA_USER = "test-user-yamada";
const TANAKA = "test-company-tanaka-tosou"; // 田中塗装 = 受注者
const SUZUKI = "test-company-suzuki-denki"; // 鈴木電気（株）= 受注者

type Line = { name: string; quantity: number; unit: string; priceUnit: number };
const subtotalOf = (lines: Line[]) => lines.reduce((s, l) => s + Math.ceil(l.quantity * l.priceUnit), 0);

async function cleanup() {
  const orders = await prisma.factoryFloorOrder.findMany({
    where: { id: { startsWith: "seedpg-" } },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);
  const floorIds = (
    await prisma.factoryFloor.findMany({ where: { id: { startsWith: "seedpg-" } }, select: { id: true } })
  ).map((f) => f.id);

  // テスト中に作られた請求書（出来高/発注を含むもの）も削除
  const invoices = await prisma.document.findMany({
    where: { type: "INVOICE", factoryFloorOrderId: { in: orderIds } },
    select: { id: true },
  });
  await prisma.document.deleteMany({ where: { id: { in: invoices.map((i) => i.id) } } });
  await prisma.notification.deleteMany({
    where: { OR: [{ targetId: { in: [...orderIds, ...floorIds] } }, { factoryFloorId: { in: floorIds } }] },
  });
  await prisma.message.deleteMany({ where: { factoryFloorOrderId: { in: orderIds } } });
  await prisma.evaluation.deleteMany({ where: { factoryFloorOrderId: { in: orderIds } } }).catch(() => {});
  await prisma.progressBilling.deleteMany({ where: { factoryFloorOrderId: { in: orderIds } } });
  await prisma.completionReport.deleteMany({ where: { factoryFloorOrderId: { in: orderIds } } });
  await prisma.document.deleteMany({ where: { factoryFloorOrderId: { in: orderIds } } });
  await prisma.message.deleteMany({ where: { roomId: { startsWith: "seedpg-" } } });
  await prisma.chatRoom.deleteMany({ where: { id: { startsWith: "seedpg-" } } });
  await prisma.priceOrderDetail.deleteMany({ where: { id: { startsWith: "seedpg-" } } });
  await prisma.factoryFloorOrder.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.factoryFloor.deleteMany({ where: { id: { startsWith: "seedpg-" }, parentId: { not: null } } });
  await prisma.factoryFloor.deleteMany({ where: { id: { startsWith: "seedpg-" } } });
  console.log("🧹 既存の seedpg- データを削除しました");
}

async function createOrder(params: {
  key: string;
  floorId: string;
  worker: string;
  lines: Line[];
  additional?: boolean;
  createdAt: Date;
}) {
  const subtotal = subtotalOf(params.lines);
  const tax = Math.ceil(subtotal * 0.1);
  const orderId = `seedpg-order-${params.key}`;
  await prisma.factoryFloorOrder.create({
    data: {
      id: orderId,
      factoryFloorId: params.floorId,
      workCompanyId: params.worker,
      status: "CONFIRMED",
      completionStatus: "NONE",
      actualAmount: BigInt(subtotal + tax),
      createdAt: params.createdAt,
      inspectionData: params.additional
        ? {
            type: "ADDITIONAL_ORDER",
            priceDetails: params.lines.map((l) => ({
              name: l.name,
              quantity: l.quantity,
              unitId: l.unit,
              priceUnit: l.priceUnit,
            })),
          }
        : undefined,
      message: "出来高テスト",
    },
  });
  // 注文書・注文請書はアプリと同じ発行処理で作成（PDF付き）
  const { generateOrderSheet } = await import("../lib/services/document-generator");
  await generateOrderSheet(orderId);
  return orderId;
}

async function createChatRoom(floorId: string, worker: string) {
  await prisma.chatRoom.create({
    data: {
      id: `seedpg-room-${floorId}`,
      type: "SITE_INFO",
      factoryFloorId: floorId,
      orderCompanyId: ORDERER,
      workerCompanyId: worker,
      lastMessageTime: new Date(),
    },
  });
}

async function main() {
  await cleanup();

  // ---- A. 田中塗装: 親工事 + 子工事（発注書1 + 追加工事） ----
  const parentId = "seedpg-floor-parentA";
  await prisma.factoryFloor.create({
    data: {
      id: parentId,
      createdUserId: YAMADA_USER,
      companyId: ORDERER,
      status: "IN_PROGRESS",
      code: "PG-A01",
      name: "横浜市 T様邸 外壁改修",
      budget: BigInt(2_000_000),
      address: "神奈川県横浜市青葉区1-2-3",
    },
  });
  const floorA = "seedpg-floor-A";
  const linesA: Line[] = [
    { name: "足場架設・解体", quantity: 1, unit: "一式", priceUnit: 250_000 },
    { name: "外壁塗装（下塗り・中塗り・上塗り）", quantity: 1, unit: "一式", priceUnit: 750_000 },
  ];
  await prisma.factoryFloor.create({
    data: {
      id: floorA,
      createdUserId: YAMADA_USER,
      companyId: ORDERER,
      workCompanyId: TANAKA,
      parentId,
      status: "IN_PROGRESS",
      name: "外壁塗装工事",
      contentRequest: "外壁全面塗装",
      startDayRequest: new Date(2026, 9, 1),
      endDayRequest: new Date(2026, 11, 20),
      address: "神奈川県横浜市青葉区1-2-3",
      totalAmount: BigInt(subtotalOf(linesA)),
    },
  });
  await prisma.priceOrderDetail.createMany({
    data: linesA.map((l, i) => ({
      id: `seedpg-pd-A-${i}`,
      factoryFloorId: floorA,
      name: l.name,
      quantity: l.quantity,
      unitId: l.unit,
      priceUnit: BigInt(l.priceUnit),
    })),
  });
  await createChatRoom(floorA, TANAKA);
  await createOrder({
    key: "A1", floorId: floorA, worker: TANAKA, lines: linesA, createdAt: new Date(2026, 9, 1),
  });
  await createOrder({
    key: "A2", floorId: floorA, worker: TANAKA, additional: true, createdAt: new Date(2026, 9, 10),
    lines: [{ name: "雨樋交換", quantity: 1, unit: "一式", priceUnit: 45_000 }],
  });
  console.log("🏗  A: 田中塗装 / 外壁塗装工事（発注書1 ¥1,000,000・追加工事 ¥45,000）");

  // ---- B. 鈴木電気: 10/31 申請済み・確定待ちの出来高 ----
  const floorB = "seedpg-floor-B";
  const linesB: Line[] = [{ name: "倉庫照明 LED化", quantity: 1, unit: "一式", priceUnit: 800_000 }];
  await prisma.factoryFloor.create({
    data: {
      id: floorB,
      createdUserId: YAMADA_USER,
      companyId: ORDERER,
      workCompanyId: SUZUKI,
      status: "IN_PROGRESS",
      code: "PG-B01",
      name: "港北倉庫 照明改修工事",
      contentRequest: "倉庫照明のLED化",
      startDayRequest: new Date(2026, 9, 1),
      endDayRequest: new Date(2026, 11, 25),
      address: "神奈川県横浜市港北区4-5-6",
      totalAmount: BigInt(800_000),
    },
  });
  await prisma.priceOrderDetail.create({
    data: {
      id: "seedpg-pd-B-0", factoryFloorId: floorB, name: linesB[0].name, quantity: 1,
      unitId: "一式", priceUnit: BigInt(800_000),
    },
  });
  await createChatRoom(floorB, SUZUKI);
  const orderB = await createOrder({
    key: "B1", floorId: floorB, worker: SUZUKI, lines: linesB, createdAt: new Date(2026, 9, 1),
  });
  // 2026/10/31 15:20 JST に申請（= 06:20 UTC）
  const appliedAt = new Date(Date.UTC(2026, 9, 31, 6, 20));
  await prisma.progressBilling.create({
    data: {
      factoryFloorOrderId: orderB,
      appliedAt,
      billingMonth: "202610",
      amount: BigInt(300_000),
      kind: "PARTIAL",
      status: "PENDING",
      comment: "1階・2階の照明器具交換まで完了しました。",
      photos: [],
      appliedByUserId: "test-user-suzuki",
    },
  });
  const yamadaUsers = await prisma.user.findMany({
    where: { companyId: ORDERER, isActive: true, deletedAt: null },
    select: { id: true },
  });
  await prisma.notification.createMany({
    data: yamadaUsers.map((u) => ({
      userId: u.id,
      title: "出来高の確定依頼",
      content: "鈴木電気（株）から港北倉庫 照明改修工事の出来高[10月分] ¥300,000（税抜）の確定依頼が届きました。",
      type: 44,
      factoryFloorId: floorB,
      targetId: orderB,
      createdAt: appliedAt,
    })),
  });
  console.log("🏗  B: 鈴木電気 / 港北倉庫 照明改修工事（¥800,000・出来高[10月分] ¥300,000 確定待ち）");

  console.log("\n✅ 完了");
  console.log("   受注者 tanaka@test.com → 工事完了: /work-completion/seedpg-floor-A");
  console.log("   発注者 yamada@test.com → 出来高の確定: /orders/seedpg-order-B1/progress");
}

main()
  .catch((e) => { console.error("❌ 失敗:", e); process.exitCode = 1; })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
    process.exit(); // 発行処理側(lib/prisma)の接続プールを残さず終了する
  });
