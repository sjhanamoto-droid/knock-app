import { prisma } from "@/lib/prisma";
import { generateInvoice } from "@/lib/services/document-generator";
import { getBillingPeriod } from "@/lib/helpers/billing-period";
import { getInvoicedProgressIds } from "@/lib/helpers/invoiced-orders";

/**
 * 支払期日を計算（invoices.ts のコピー）
 * "use server" ファイルへの依存を避けるためここに複製する。
 */
function calculateDueDate(
  type: string | null | undefined,
  billingYear: number,
  billingMonth: number
): Date | null {
  if (!type) return null;

  switch (type) {
    case "NEXT_MONTH_END": {
      const d = new Date(billingYear, billingMonth + 1, 0);
      return d;
    }
    case "NEXT_MONTH_25": {
      return new Date(billingYear, billingMonth, 25);
    }
    case "NEXT_MONTH_20": {
      return new Date(billingYear, billingMonth, 20);
    }
    case "NEXT_MONTH_15": {
      return new Date(billingYear, billingMonth, 15);
    }
    case "TWO_MONTHS_END": {
      const d = new Date(billingYear, billingMonth + 2, 0);
      return d;
    }
    default:
      return null;
  }
}

/**
 * 発注者の締め日に基づいてドラフト請求書を受注者ごとに自動生成（Cron用）
 */
export async function generateDraftInvoices(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      billingClosingDay: true,
      billingGraceDays: true,
      paymentDueType: true,
    },
  });
  if (!company) return [];

  // 対象月の yearMonth を計算（cronはUTC15時=JST0時実行のためJST基準に統一）
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yearMonth = `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;

  // 対象月の締切(CLOSED)発注を受注者ごとに集計
  const year = parseInt(yearMonth.substring(0, 4));
  const month = parseInt(yearMonth.substring(4, 6));
  // 発注者の締め日に基づく請求期間で集計（締め日 null は月末締め）
  const { start: startOfMonth, end: endOfMonth } = getBillingPeriod(
    yearMonth,
    company.billingClosingDay
  );

  const orders = await prisma.factoryFloorOrder.findMany({
    where: {
      deletedAt: null,
      status: "CONFIRMED",
      completionStatus: "CLOSED",
      factoryFloor: { companyId, deletedAt: null },
      completedDay: { gte: startOfMonth, lte: endOfMonth },
    },
    select: {
      workCompanyId: true,
    },
  });

  // 確定済みの出来高（請求月=申請月）も受注者ごとの請求対象に含める
  const progressItems = await prisma.progressBilling.findMany({
    where: {
      status: "CONFIRMED",
      billingMonth: yearMonth,
      factoryFloorOrder: { deletedAt: null, factoryFloor: { companyId, deletedAt: null } },
    },
    select: { factoryFloorOrder: { select: { workCompanyId: true } } },
  });

  // 過去の申請月の出来高で、その月の締め処理より後に確定したものを先に拾う
  const lateIds = await generateLateProgressInvoices(companyId, yearMonth, company.paymentDueType);

  if (orders.length === 0 && progressItems.length === 0) return lateIds;

  // 既存のドラフト請求書を確認
  const existingInvoices = await prisma.document.findMany({
    where: {
      type: "INVOICE",
      orderCompanyId: companyId,
      yearMonth,
      deletedAt: null,
    },
    select: { workerCompanyId: true },
  });

  const invoicedWorkers = new Set(existingInvoices.map((i) => i.workerCompanyId));

  // 受注者ごとにユニークなIDを集める
  const workerIds = [
    ...new Set([
      ...orders.map((o) => o.workCompanyId),
      ...progressItems.map((p) => p.factoryFloorOrder.workCompanyId),
    ]),
  ].filter(
    (id) => !invoicedWorkers.has(id)
  );

  // 支払期日を計算
  const dueDate = calculateDueDate(company.paymentDueType, year, month);

  const createdIds: string[] = [...lateIds];
  for (const workerCompanyId of workerIds) {
    try {
      const docId = await generateInvoice(workerCompanyId, companyId, yearMonth);
      // ドラフト状態に戻す + 支払期日を設定
      await prisma.document.update({
        where: { id: docId },
        data: {
          status: "DRAFT",
          dueDate,
        },
      });
      createdIds.push(docId);
    } catch {
      // 請求対象の工事がない場合はスキップ
    }
  }

  return createdIds;
}

/**
 * 出来高は申請月で請求するため、申請月の締め処理（その月の自動生成）より後に確定した出来高
 * （例: 10/31申請→11/2確定、差し戻し後に元の申請月で再送信）はその月の自動生成に乗らない。
 * 確定済み・未請求で申請月が当月より前の出来高を、受注者×申請月ごとに追加の請求書(DRAFT)にする。
 * 同じ月に既存の請求書があっても、二重請求ガードで未請求分だけが載る（同じ月に複数枚はOK）。
 */
async function generateLateProgressInvoices(
  companyId: string,
  currentYearMonth: string,
  paymentDueType: string | null,
): Promise<string[]> {
  const late = await prisma.progressBilling.findMany({
    where: {
      status: "CONFIRMED",
      billingMonth: { lt: currentYearMonth },
      factoryFloorOrder: { deletedAt: null, factoryFloor: { companyId, deletedAt: null } },
    },
    select: { id: true, billingMonth: true, factoryFloorOrder: { select: { workCompanyId: true } } },
  });
  if (late.length === 0) return [];

  const invoiced = await getInvoicedProgressIds({ orderCompanyId: companyId });
  const groups = new Set(
    late
      .filter((p) => !invoiced.has(p.id))
      .map((p) => `${p.factoryFloorOrder.workCompanyId}::${p.billingMonth}`)
  );

  const created: string[] = [];
  for (const key of groups) {
    const [workerCompanyId, billingMonth] = key.split("::");
    try {
      const docId = await generateInvoice(workerCompanyId, companyId, billingMonth);
      const dueDate = calculateDueDate(
        paymentDueType,
        parseInt(billingMonth.substring(0, 4), 10),
        parseInt(billingMonth.substring(4, 6), 10)
      );
      await prisma.document.update({ where: { id: docId }, data: { status: "DRAFT", dueDate } });
      created.push(docId);
    } catch {
      // 請求対象なし（同時に作成済み等）はスキップ
    }
  }
  return created;
}

/**
 * 猶予期限超過の請求書を自動確定（Cron用）
 */
export async function autoConfirmOverdueInvoices() {
  const now = new Date();

  // 全社のドラフト請求書を取得
  const draftInvoices = await prisma.document.findMany({
    where: {
      type: "INVOICE",
      status: "DRAFT",
      deletedAt: null,
    },
    include: {
      orderCompany: {
        select: {
          billingClosingDay: true,
          billingGraceDays: true,
        },
      },
    },
  });

  let confirmedCount = 0;

  for (const invoice of draftInvoices) {
    if (!invoice.yearMonth) continue;

    const graceDays = invoice.orderCompany.billingGraceDays ?? 5;
    const closingDay = invoice.orderCompany.billingClosingDay;
    const year = parseInt(invoice.yearMonth.substring(0, 4));
    const month = parseInt(invoice.yearMonth.substring(4, 6));

    // 締め日を計算
    let closingDate: Date;
    if (closingDay) {
      closingDate = new Date(year, month - 1, closingDay);
    } else {
      // 月末
      closingDate = new Date(year, month, 0);
    }

    // 猶予期限 = 締め日 + 猶予日数
    const graceDeadline = new Date(closingDate);
    graceDeadline.setDate(graceDeadline.getDate() + graceDays);

    if (now > graceDeadline) {
      await prisma.document.update({
        where: { id: invoice.id },
        data: {
          status: "ISSUED",
          autoConfirmedAt: now,
          confirmedAt: now,
        },
      });

      // 受注者に通知
      const contractorUsers = await prisma.user.findMany({
        where: { companyId: invoice.workerCompanyId, isActive: true, deletedAt: null },
        select: { id: true },
      });

      if (contractorUsers.length > 0) {
        await prisma.notification.createMany({
          data: contractorUsers.map((u) => ({
            userId: u.id,
            title: "請求書自動確定",
            content: `${invoice.yearMonth?.substring(0, 4)}年${invoice.yearMonth?.substring(4)}月分の請求書が自動確定されました`,
            type: 41,
            targetId: invoice.id,
          })),
        });
      }

      confirmedCount++;
    }
  }

  return { confirmedCount };
}
