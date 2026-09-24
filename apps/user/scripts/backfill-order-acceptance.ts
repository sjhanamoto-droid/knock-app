/**
 * 既存の注文書(ORDER_SHEET)に対して注文請書(ORDER_ACCEPTANCE)を作成するバックフィル。
 * 注文請書の自動作成(generateOrderSheet 内)より前に発行された注文書が対象。冪等（作成済みはスキップ）。
 *
 * 実行（apps/user で。DATABASE_URL の向き先に注意）:
 *   set -a; . ./.env; set +a
 *   ../../packages/db/node_modules/.bin/tsx scripts/backfill-order-acceptance.ts
 *
 * --regenerate: 作成済みの注文請書のPDFも請書番号はそのままで作り直す（レイアウト変更の反映用）
 */
import { prisma } from "@/lib/prisma";
import { generateOrderAcceptance } from "@/lib/services/document-generator";

const regenerate = process.argv.includes("--regenerate");

async function main() {
  const sheets = await prisma.document.findMany({
    where: { type: "ORDER_SHEET", status: { not: "VOID" }, deletedAt: null },
    select: { id: true, documentNumber: true },
    orderBy: { issuedAt: "asc" },
  });

  let created = 0;
  let regenerated = 0;
  let failed = 0;
  for (const sheet of sheets) {
    const before = await prisma.document.count({
      where: { type: "ORDER_ACCEPTANCE", deletedAt: null, metadata: { path: ["orderSheetId"], equals: sheet.id } },
    });
    try {
      await generateOrderAcceptance(sheet.id, { regenerate });
      if (before === 0) {
        created++;
        console.log(`created: ${sheet.documentNumber}`);
      } else if (regenerate) {
        regenerated++;
      }
    } catch (e) {
      failed++;
      console.error(`failed: ${sheet.documentNumber}`, e);
    }
  }
  console.log(`done. order sheets=${sheets.length} created=${created} regenerated=${regenerated} failed=${failed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
