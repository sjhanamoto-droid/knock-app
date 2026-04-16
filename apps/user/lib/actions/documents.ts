"use server";

import { prisma } from "@knock/db";
import { requireSession } from "@/lib/session";

/**
 * 帳票一覧を取得（種類別・月別フィルタ対応）
 */
export async function getDocuments(filters?: {
  type?: "ORDER_SHEET" | "DELIVERY_NOTE" | "INVOICE";
  yearMonth?: string;
  page?: number;
  limit?: number;
}) {
  const user = await requireSession();
  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    deletedAt: null,
    OR: [
      { orderCompanyId: user.companyId },
      { workerCompanyId: user.companyId },
    ],
  };

  if (filters?.type) {
    where.type = filters.type;
  }

  if (filters?.yearMonth) {
    const year = parseInt(filters.yearMonth.substring(0, 4));
    const month = parseInt(filters.yearMonth.substring(4, 6));
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    where.issuedAt = { gte: startOfMonth, lte: endOfMonth };
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip,
      take: limit,
      include: {
        orderCompany: { select: { id: true, name: true } },
        workerCompany: { select: { id: true, name: true } },
        factoryFloorOrder: {
          select: {
            factoryFloor: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.document.count({ where }),
  ]);

  return {
    documents: documents.map((doc) => ({
      id: doc.id,
      type: doc.type,
      status: doc.status,
      documentNumber: doc.documentNumber,
      totalAmount: doc.totalAmount ? Number(doc.totalAmount) : null,
      issuedAt: doc.issuedAt,
      pdfUrl: doc.pdfUrl,
      orderCompanyName: doc.orderCompany.name,
      workerCompanyName: doc.workerCompany.name,
      siteName: doc.factoryFloorOrder?.factoryFloor?.name ?? "",
      isMyCompanyOrderer: doc.orderCompanyId === user.companyId,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * 帳票詳細を取得
 */
export async function getDocumentDetail(documentId: string) {
  const user = await requireSession();

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      deletedAt: null,
      OR: [
        { orderCompanyId: user.companyId },
        { workerCompanyId: user.companyId },
      ],
    },
    include: {
      orderCompany: {
        select: {
          id: true, name: true, postalCode: true, prefecture: true,
          city: true, streetAddress: true, building: true, invoiceNumber: true,
        },
      },
      workerCompany: {
        select: {
          id: true, name: true, postalCode: true, prefecture: true,
          city: true, streetAddress: true, building: true, invoiceNumber: true,
          bankName: true, bankBranchName: true, bankAccountType: true,
          bankAccountNumber: true, bankAccountName: true,
        },
      },
      factoryFloorOrder: {
        include: {
          factoryFloor: {
            select: {
              id: true, name: true, address: true,
              startDayRequest: true, endDayRequest: true,
              priceDetails: { where: { deletedAt: null }, include: { unit: true } },
            },
          },
        },
      },
    },
  });

  if (!document) throw new Error("帳票が見つかりません");

  return {
    ...document,
    subtotal: document.subtotal ? Number(document.subtotal) : null,
    taxAmount: document.taxAmount ? Number(document.taxAmount) : null,
    totalAmount: document.totalAmount ? Number(document.totalAmount) : null,
  };
}
