/**
 * 請求書テスト用データ生成スクリプト（山田建設[発注者] ↔ 鈴木電気/田中塗装[受注者]）
 *
 * 実行:
 *   set -a; . apps/user/.env; set +a
 *   packages/db/node_modules/.bin/tsx apps/user/scripts/seed-billing-test.ts
 *
 * 生成物（すべて id が "seedbs-" 始まり = 再実行時に洗い替え）:
 *  - 今月: 鈴木電気に締め完了(CLOSED)の現場5件（親工事1+子3、単独2）→ 請求候補
 *  - 今月: 田中塗装に締め完了2件 → 会社ごと絞り込みの検証用（別会社が混ざらないことを確認）
 *  - 先月: 鈴木電気に締め完了2件 + それらをまとめた請求書(DRAFT)1件 → 受注者の確認専用画面をすぐ試せる
 */
import { PrismaClient } from "../generated/prisma/index.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ---- 会社・ユーザー（既存のテストアカウント） ----
const ORDERER = "test-company-yamada-kensetsu"; // 山田建設（株）= 発注者
const YAMADA_USER = "test-user-yamada";
const SUZUKI = "test-company-suzuki-denki"; // 鈴木電気（株）= 受注者
const TANAKA = "test-company-tanaka-tosou"; // 田中塗装 = 受注者(2社目)

// ---- 対象月（今月 / 先月）を実行時点から算出 ----
const now = new Date();
const CUR_Y = now.getFullYear();
const CUR_M = now.getMonth(); // 0-11
const prev = new Date(CUR_Y, CUR_M - 1, 1);
const PREV_Y = prev.getFullYear();
const PREV_M = prev.getMonth();
const ym = (y: number, m0: number) => `${y}${String(m0 + 1).padStart(2, "0")}`;

type Line = { name: string; quantity: number; unit: string; priceUnit: number };
type SiteSpec = {
  key: string;
  code: string | null;
  name: string;
  worker: string;
  parentKey?: string; // 子工事なら親の key
  completedDay: Date;
  lines: Line[];
  content: string;
};

// ---- 親工事（予算管理用・発注なし） ----
const PARENT = {
  key: "parent1",
  code: "TST-P01",
  name: "パークサイド町田 大規模改修工事",
  budget: 5_000_000,
};

// ---- 現場定義 ----
const sites: SiteSpec[] = [
  // 今月・鈴木電気（親工事の子3件）
  {
    key: "c1", code: null, name: "電気設備幹線工事", worker: SUZUKI, parentKey: PARENT.key,
    completedDay: new Date(CUR_Y, CUR_M, 4), content: "受変電〜各階への幹線敷設一式",
    lines: [
      { name: "幹線ケーブル敷設", quantity: 1, unit: "一式", priceUnit: 520_000 },
      { name: "ケーブルラック設置", quantity: 1, unit: "一式", priceUnit: 280_000 },
    ],
  },
  {
    key: "c2", code: null, name: "共用部LED照明更新", worker: SUZUKI, parentKey: PARENT.key,
    completedDay: new Date(CUR_Y, CUR_M, 6), content: "共用部照明器具のLED化",
    lines: [{ name: "LED照明器具 交換", quantity: 120, unit: "台", priceUnit: 3_500 }],
  },
  {
    key: "c3", code: null, name: "受変電設備点検更新", worker: SUZUKI, parentKey: PARENT.key,
    completedDay: new Date(CUR_Y, CUR_M, 8), content: "分電盤更新および絶縁測定",
    lines: [
      { name: "分電盤 更新", quantity: 4, unit: "台", priceUnit: 85_000 },
      { name: "絶縁抵抗測定", quantity: 1, unit: "式", priceUnit: 40_000 },
    ],
  },
  // 今月・鈴木電気（単独現場2件）
  {
    key: "s1", code: "TST-S01", name: "山田ビル テナント コンセント増設", worker: SUZUKI,
    completedDay: new Date(CUR_Y, CUR_M, 5), content: "OA用コンセントの増設",
    lines: [{ name: "コンセント増設", quantity: 10, unit: "箇所", priceUnit: 6_500 }],
  },
  {
    key: "s2", code: "TST-S02", name: "個人邸 太陽光発電 配線工事", worker: SUZUKI,
    completedDay: new Date(CUR_Y, CUR_M, 10), content: "PVパネル〜パワコンの配線一式",
    lines: [
      { name: "PVストリング配線", quantity: 1, unit: "一式", priceUnit: 180_000 },
      { name: "パワーコンディショナ接続", quantity: 1, unit: "一式", priceUnit: 60_000 },
    ],
  },
  // 今月・田中塗装（会社ごと絞り込みの検証用）
  {
    key: "t1", code: "TST-T01", name: "山田ビル 外壁塗装工事", worker: TANAKA,
    completedDay: new Date(CUR_Y, CUR_M, 7), content: "外壁全面塗装（下地補修含む）",
    lines: [{ name: "外壁塗装 一式", quantity: 1, unit: "一式", priceUnit: 680_000 }],
  },
  {
    key: "t2", code: "TST-T02", name: "屋上防水改修工事", worker: TANAKA,
    completedDay: new Date(CUR_Y, CUR_M, 9), content: "屋上シート防水改修",
    lines: [{ name: "シート防水改修", quantity: 1, unit: "一式", priceUnit: 320_000 }],
  },
  // 先月・鈴木電気（請求書済みにする2件）
  {
    key: "j1", code: "TST-S03", name: "旧本社ビル 電気改修工事", worker: SUZUKI,
    completedDay: new Date(PREV_Y, PREV_M, 12), content: "電灯コンセント改修・幹線更新",
    lines: [
      { name: "電灯コンセント改修", quantity: 1, unit: "一式", priceUnit: 340_000 },
      { name: "幹線更新", quantity: 1, unit: "一式", priceUnit: 180_000 },
    ],
  },
  {
    key: "j2", code: "TST-S04", name: "第2倉庫 動力設備工事", worker: SUZUKI,
    completedDay: new Date(PREV_Y, PREV_M, 20), content: "動力盤設置・動力配線",
    lines: [
      { name: "動力盤 設置", quantity: 1, unit: "台", priceUnit: 220_000 },
      { name: "動力配線", quantity: 1, unit: "一式", priceUnit: 90_000 },
    ],
  },
];

const subtotalOf = (lines: Line[]) =>
  lines.reduce((s, l) => s + Math.ceil(l.quantity * l.priceUnit), 0);

let docSeq = 0;
const orderSheetNumber = (ymStr: string) => `ORD-${ymStr}-TST${String(++docSeq).padStart(2, "0")}`;

async function cleanup() {
  // FK 順に削除（documents → priceDetails → orders → floors[子] → floors[親/単独]）
  await prisma.document.deleteMany({ where: { id: { startsWith: "seedbs-" } } });
  await prisma.priceOrderDetail.deleteMany({ where: { id: { startsWith: "seedbs-" } } });
  await prisma.factoryFloorOrder.deleteMany({ where: { id: { startsWith: "seedbs-" } } });
  await prisma.factoryFloor.deleteMany({ where: { id: { startsWith: "seedbs-" }, parentId: { not: null } } });
  await prisma.factoryFloor.deleteMany({ where: { id: { startsWith: "seedbs-" } } });
  console.log("🧹 既存の seedbs- データを削除しました");
}

async function createParent() {
  await prisma.factoryFloor.create({
    data: {
      id: `seedbs-floor-${PARENT.key}`,
      createdUserId: YAMADA_USER,
      companyId: ORDERER,
      status: "IN_PROGRESS",
      code: PARENT.code,
      name: PARENT.name,
      budget: BigInt(PARENT.budget),
      address: "東京都町田市中町1-2-3",
      remarks: "テスト用の親工事（予算管理）",
    },
  });
  console.log(`🏗  親工事: ${PARENT.name} (${PARENT.code})`);
}

async function createSite(spec: SiteSpec) {
  const subtotal = subtotalOf(spec.lines);
  const tax = Math.ceil(subtotal * 0.1);
  const total = subtotal + tax;
  const floorId = `seedbs-floor-${spec.key}`;
  const orderId = `seedbs-order-${spec.key}`;
  const parentId = spec.parentKey ? `seedbs-floor-${spec.parentKey}` : null;
  const ymStr = ym(spec.completedDay.getFullYear(), spec.completedDay.getMonth());
  const siteCode = spec.code ?? PARENT.code; // 子は親コードを継承

  // 現場
  await prisma.factoryFloor.create({
    data: {
      id: floorId,
      createdUserId: YAMADA_USER,
      companyId: ORDERER,
      workCompanyId: spec.worker,
      status: "COMPLETED", // 締め完了相当
      code: spec.code,
      name: spec.name,
      parentId,
      contentRequest: spec.content,
      startDayRequest: new Date(spec.completedDay.getFullYear(), spec.completedDay.getMonth(), 1),
      endDayRequest: spec.completedDay,
      finishDay: spec.completedDay,
      address: "東京都町田市中町1-2-3",
      totalAmount: BigInt(subtotal),
    },
  });

  // 明細（PriceOrderDetail）
  await prisma.priceOrderDetail.createMany({
    data: spec.lines.map((l, i) => ({
      id: `seedbs-pd-${spec.key}-${i}`,
      factoryFloorId: floorId,
      name: l.name,
      quantity: l.quantity,
      unitId: l.unit,
      priceUnit: BigInt(l.priceUnit),
    })),
  });

  // 発注（CONFIRMED / CLOSED）
  await prisma.factoryFloorOrder.create({
    data: {
      id: orderId,
      factoryFloorId: floorId,
      workCompanyId: spec.worker,
      status: "CONFIRMED",
      completionStatus: "CLOSED",
      completedDay: spec.completedDay,
      actualAmount: BigInt(total),
      message: "締め完了（テストデータ）",
    },
  });

  // 注文書（ORDER_SHEET / ISSUED）
  const fullSiteName = spec.parentKey ? `${PARENT.name}_${spec.name}` : spec.name;
  await prisma.document.create({
    data: {
      id: `seedbs-doc-os-${spec.key}`,
      type: "ORDER_SHEET",
      status: "ISSUED",
      documentNumber: orderSheetNumber(ymStr),
      factoryFloorOrderId: orderId,
      orderCompanyId: ORDERER,
      workerCompanyId: spec.worker,
      subtotal: BigInt(subtotal),
      taxAmount: BigInt(tax),
      totalAmount: BigInt(total),
      issuedAt: spec.completedDay,
      metadata: {
        siteName: fullSiteName,
        siteCode,
        orderCompanyName: "山田建設（株）",
        workerCompanyName: spec.worker === SUZUKI ? "鈴木電気（株）" : "田中塗装",
        lineItems: spec.lines.map((l) => ({
          name: l.name, quantity: l.quantity, unit: l.unit, priceUnit: l.priceUnit,
        })),
        priceDetails: spec.lines.map((l) => ({
          name: l.name, quantity: l.quantity, unit: l.unit, priceUnit: l.priceUnit,
        })),
      },
    },
  });

  console.log(
    `  ・${spec.worker === SUZUKI ? "鈴木" : "田中"} / ${spec.name} [${ymStr}] 税込¥${total.toLocaleString()}`
  );
  return { orderId, subtotal, tax, total, siteCode, name: spec.name, docNumber: null as string | null };
}

async function createPrevInvoice(julyKeys: string[]) {
  // 先月・鈴木電気の2発注をまとめた請求書(DRAFT)
  const orderIds = julyKeys.map((k) => `seedbs-order-${k}`);
  const sheets = await prisma.document.findMany({
    where: { type: "ORDER_SHEET", factoryFloorOrderId: { in: orderIds }, deletedAt: null },
    select: {
      documentNumber: true, subtotal: true, taxAmount: true, totalAmount: true,
      factoryFloorOrderId: true, metadata: true,
    },
  });
  let subtotal = 0n, tax = 0n, total = 0n;
  for (const s of sheets) {
    subtotal += s.subtotal ?? 0n;
    tax += s.taxAmount ?? 0n;
    total += s.totalAmount ?? 0n;
  }
  const yearMonth = ym(PREV_Y, PREV_M);
  const lineItems = sheets.map((s) => {
    const meta = (s.metadata as Record<string, unknown>) ?? {};
    return {
      documentNumber: s.documentNumber,
      siteName: (meta.siteName as string) ?? "",
      siteCode: (meta.siteCode as string) ?? "",
      amount: Number(s.totalAmount ?? 0n),
    };
  });

  await prisma.document.create({
    data: {
      id: "seedbs-doc-inv-july",
      type: "INVOICE",
      status: "DRAFT", // 確認待ち（発注者は確定可 / 受注者は確認のみ）
      documentNumber: `INV-${yearMonth}-TST01`,
      factoryFloorOrderId: orderIds[0],
      orderCompanyId: ORDERER,
      workerCompanyId: SUZUKI,
      subtotal, taxAmount: tax, totalAmount: total,
      issuedAt: new Date(PREV_Y, PREV_M, 28),
      yearMonth,
      metadata: { orderIds, lineItems },
    },
  });
  console.log(`🧾 先月分の請求書(DRAFT) INV-${yearMonth}-TST01 税込¥${Number(total).toLocaleString()}（鈴木電気）`);
}

async function main() {
  console.log(`\n=== 請求テストデータ生成: 今月=${ym(CUR_Y, CUR_M)} / 先月=${ym(PREV_Y, PREV_M)} ===`);
  await cleanup();
  await createParent();
  console.log("📄 現場・発注・注文書を作成:");
  for (const s of sites) await createSite(s);
  await createPrevInvoice(["j1", "j2"]);

  // サマリ
  const augSuzuki = sites.filter((s) => s.worker === SUZUKI && s.completedDay.getMonth() === CUR_M);
  const augTanaka = sites.filter((s) => s.worker === TANAKA && s.completedDay.getMonth() === CUR_M);
  console.log("\n✅ 完了");
  console.log(`   今月の請求候補: 鈴木電気=${augSuzuki.length}件 / 田中塗装=${augTanaka.length}件`);
  console.log(`   先月の請求書(確認用): 鈴木電気=1件(DRAFT)`);
}

main()
  .catch((e) => { console.error("❌ 失敗:", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
