"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import type { CreateFactoryFloorInput, UpdateFactoryFloorInput } from "@knock/types";

// ============ ヘルパー ============

function serializeBigInt<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? Number(v) : v))
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toBigIntOrNull(v: any): bigint | null {
  if (v === "" || v == null) return null;
  return BigInt(Number(v));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toNumberOrNull(v: any): number | null {
  if (v === "" || v == null) return null;
  return Number(v);
}

// ============ 一覧取得 ============

export type SiteSortField = "createdAt" | "startDayRequest" | "endDayRequest";
export type SiteSortOrder = "asc" | "desc";

export async function getSites(
  status?: string,
  search?: string,
  sortBy: SiteSortField = "createdAt",
  sortOrder: SiteSortOrder = "desc"
) {
  const user = await requireSession();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    companyId: user.companyId,
    deletedAt: null,
    parentId: null, // 親現場のみ表示
  };

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { address: { contains: search, mode: "insensitive" } },
    ];
  }

  const sites = await prisma.factoryFloor.findMany({
    where,
    orderBy: { [sortBy]: sortOrder },
    include: {
      workCompany: { select: { name: true } },
      _count: { select: { members: true, orders: true, children: true } },
    },
  });

  return serializeBigInt(sites);
}

// ============ 受注者向け一覧取得 ============

export async function getContractorSites(
  status?: string,
  search?: string,
  sortBy: SiteSortField = "createdAt",
  sortOrder: SiteSortOrder = "desc"
) {
  const user = await requireSession();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    workCompanyId: user.companyId,
    deletedAt: null,
  };

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { address: { contains: search, mode: "insensitive" } },
    ];
  }

  const sites = await prisma.factoryFloor.findMany({
    where,
    orderBy: { [sortBy]: sortOrder },
    include: {
      company: { select: { name: true } },
      _count: { select: { members: true, orders: true } },
    },
  });

  return serializeBigInt(sites);
}

// ============ 詳細取得 ============

export async function getSite(id: string) {
  const user = await requireSession();

  const site = await prisma.factoryFloor.findFirst({
    where: {
      id,
      OR: [
        { companyId: user.companyId },
        { workCompanyId: user.companyId },
      ],
      deletedAt: null,
    },
    include: {
      workCompany: { select: { id: true, name: true } },
      members: {
        where: { deletedAt: null },
        include: {
          user: {
            select: {
              id: true,
              lastName: true,
              firstName: true,
              email: true,
              avatar: true,
            },
          },
        },
      },
      orders: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
      images: { where: { deletedAt: null } },
      pdfs: { where: { deletedAt: null } },
      occupations: {
        include: {
          occupationSubItem: {
            include: { occupationMajorItem: true },
          },
        },
      },
      priceDetails: {
        where: { deletedAt: null },
        include: { unit: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      chatRooms: {
        where: { type: "SITE_INFO", deletedAt: null },
        select: { id: true, status: true },
        take: 1,
      },
      children: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: {
          workCompany: { select: { id: true, name: true } },
          orders: {
            where: { deletedAt: null },
            select: { id: true, status: true, actualAmount: true },
          },
          chatRooms: {
            where: { type: "SITE_INFO", deletedAt: null },
            select: { id: true, status: true },
            take: 1,
          },
        },
      },
    },
  });

  return serializeBigInt(site);
}

// ============ 新規作成 ============

export type ChildSiteInput = {
  name: string;
  contentRequest?: string;
  startDayRequest?: string;
  endDayRequest?: string;
  totalAmount?: number | string;
};

export async function createSite(data: CreateFactoryFloorInput & {
  imageDrawingUrls?: string[];
  imagePhotoUrls?: string[];
  pdfInvoiceUrls?: string[];
  pdfPurchaseOrderUrls?: string[];
  children?: ChildSiteInput[];
}) {
  const user = await requireSession();

  const result = await prisma.$transaction(async (tx) => {
    // 1. 現場レコード作成
    const site = await tx.factoryFloor.create({
      data: {
        createdUserId: user.id,
        companyId: user.companyId,
        status: "NOT_ORDERED",
        name: data.name,
        code: data.code || null,
        contentRequest: data.contentRequest || null,
        remarks: data.remarks || null,
        address: data.address || null,
        deliveryDest: data.deliveryDest || null,
        startDayRequest: data.startDayRequest ? new Date(data.startDayRequest) : null,
        endDayRequest: data.endDayRequest ? new Date(data.endDayRequest) : null,
        totalAmount: toBigIntOrNull(data.totalAmount),
        totalAdvancePayment: toNumberOrNull(data.totalAdvancePayment),
        expenses: toBigIntOrNull(data.expenses),
        paymentType: toNumberOrNull(data.paymentType),
        paymentLatterMonth: toNumberOrNull(data.paymentLatterMonth),
        paymentLatterDay: toNumberOrNull(data.paymentLatterDay),
        parentId: data.parentId || null,
        budget: toBigIntOrNull(data.budget),
      },
    });

    // 2. 工種
    if (data.occupations && data.occupations.length > 0) {
      await tx.factoryFloorOccupation.createMany({
        data: data.occupations.map((o: { occupationSubItemId: string }) => ({
          factoryFloorId: site.id,
          occupationSubItemId: o.occupationSubItemId,
        })),
      });
    }

    // 3. 明細
    if (data.priceDetails && data.priceDetails.length > 0) {
      await tx.priceOrderDetail.createMany({
        data: data.priceDetails.map((d: { name: string; quantity: number; unitId?: string; priceUnit: number; specifications?: string }) => ({
          factoryFloorId: site.id,
          name: d.name,
          quantity: d.quantity,
          unitId: d.unitId || null,
          priceUnit: BigInt(d.priceUnit),
          specifications: d.specifications || null,
        })),
      });
    }

    // 4. 画像
    const imageRecords = [
      ...(data.imageDrawingUrls ?? []).map((url: string) => ({ factoryFloorId: site.id, url, type: 1 })),
      ...(data.imagePhotoUrls ?? []).map((url: string) => ({ factoryFloorId: site.id, url, type: 2 })),
    ];
    if (imageRecords.length > 0) {
      await tx.factoryFloorImage.createMany({ data: imageRecords });
    }

    // 5. PDF
    const pdfRecords = [
      ...(data.pdfInvoiceUrls ?? []).map((url: string) => ({ factoryFloorId: site.id, url, type: 1 })),
      ...(data.pdfPurchaseOrderUrls ?? []).map((url: string) => ({ factoryFloorId: site.id, url, type: 2 })),
    ];
    if (pdfRecords.length > 0) {
      await tx.factoryFloorPdf.createMany({ data: pdfRecords });
    }

    // 6. 作成者をメンバーに追加
    await tx.factoryFloorMember.create({
      data: {
        factoryFloorId: site.id,
        userId: user.id,
        type: 1,
      },
    });

    // 7. 子現場の一括作成（親現場作成時）
    if (data.children && data.children.length > 0) {
      for (const child of data.children) {
        const childSite = await tx.factoryFloor.create({
          data: {
            createdUserId: user.id,
            companyId: user.companyId,
            status: "NOT_ORDERED",
            parentId: site.id,
            name: child.name,
            contentRequest: child.contentRequest || null,
            address: data.address || null,
            startDayRequest: child.startDayRequest ? new Date(child.startDayRequest) : null,
            endDayRequest: child.endDayRequest ? new Date(child.endDayRequest) : null,
            totalAmount: toBigIntOrNull(child.totalAmount),
          },
        });
        await tx.factoryFloorMember.create({
          data: {
            factoryFloorId: childSite.id,
            userId: user.id,
            type: 1,
          },
        });
      }
    }

    return site;
  });

  return serializeBigInt(result);
}

// ============ 更新 ============

export async function updateSite(
  id: string,
  data: UpdateFactoryFloorInput & {
    imageDrawingUrls?: string[];
    imagePhotoUrls?: string[];
    pdfInvoiceUrls?: string[];
    pdfPurchaseOrderUrls?: string[];
  }
) {
  const user = await requireSession();

  const existing = await prisma.factoryFloor.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!existing) throw new Error("現場が見つかりません");

  const result = await prisma.$transaction(async (tx) => {
    // 1. スカラーフィールド更新
    const site = await tx.factoryFloor.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code,
        contentRequest: data.contentRequest,
        remarks: data.remarks,
        address: data.address,
        deliveryDest: data.deliveryDest,
        startDayRequest: data.startDayRequest ? new Date(data.startDayRequest) : undefined,
        endDayRequest: data.endDayRequest ? new Date(data.endDayRequest) : undefined,
        totalAmount: toBigIntOrNull(data.totalAmount) ?? undefined,
        totalAdvancePayment: toNumberOrNull(data.totalAdvancePayment) ?? undefined,
        expenses: toBigIntOrNull(data.expenses) ?? undefined,
        paymentType: toNumberOrNull(data.paymentType) ?? undefined,
        paymentLatterMonth: toNumberOrNull(data.paymentLatterMonth) ?? undefined,
        paymentLatterDay: toNumberOrNull(data.paymentLatterDay) ?? undefined,
      },
    });

    // 2. 工種: 全削除 → 再作成
    if (data.occupations !== undefined) {
      await tx.factoryFloorOccupation.deleteMany({
        where: { factoryFloorId: id },
      });
      if (data.occupations.length > 0) {
        await tx.factoryFloorOccupation.createMany({
          data: data.occupations.map((o: { occupationSubItemId: string }) => ({
            factoryFloorId: id,
            occupationSubItemId: o.occupationSubItemId,
          })),
        });
      }
    }

    // 3. 明細: 削除 + 作成/更新
    if (data.deletedPriceDetailIds && data.deletedPriceDetailIds.length > 0) {
      await tx.priceOrderDetail.updateMany({
        where: { id: { in: data.deletedPriceDetailIds }, factoryFloorId: id },
        data: { deletedAt: new Date() },
      });
    }
    if (data.priceDetails && data.priceDetails.length > 0) {
      for (const detail of data.priceDetails) {
        if (detail.id) {
          await tx.priceOrderDetail.update({
            where: { id: detail.id },
            data: {
              name: detail.name,
              quantity: detail.quantity,
              unitId: detail.unitId || null,
              priceUnit: BigInt(detail.priceUnit),
              specifications: detail.specifications || null,
            },
          });
        } else {
          await tx.priceOrderDetail.create({
            data: {
              factoryFloorId: id,
              name: detail.name,
              quantity: detail.quantity,
              unitId: detail.unitId || null,
              priceUnit: BigInt(detail.priceUnit),
              specifications: detail.specifications || null,
            },
          });
        }
      }
    }

    // 4. 画像削除
    if (data.deletedImageIds && data.deletedImageIds.length > 0) {
      await tx.factoryFloorImage.updateMany({
        where: { id: { in: data.deletedImageIds }, factoryFloorId: id },
        data: { deletedAt: new Date() },
      });
    }

    // 5. 画像追加
    const newImages = [
      ...(data.imageDrawingUrls ?? []).map((url: string) => ({ factoryFloorId: id, url, type: 1 })),
      ...(data.imagePhotoUrls ?? []).map((url: string) => ({ factoryFloorId: id, url, type: 2 })),
    ];
    if (newImages.length > 0) {
      await tx.factoryFloorImage.createMany({ data: newImages });
    }

    // 6. PDF削除
    if (data.deletedPdfIds && data.deletedPdfIds.length > 0) {
      await tx.factoryFloorPdf.updateMany({
        where: { id: { in: data.deletedPdfIds }, factoryFloorId: id },
        data: { deletedAt: new Date() },
      });
    }

    // 7. PDF追加
    const newPdfs = [
      ...(data.pdfInvoiceUrls ?? []).map((url: string) => ({ factoryFloorId: id, url, type: 1 })),
      ...(data.pdfPurchaseOrderUrls ?? []).map((url: string) => ({ factoryFloorId: id, url, type: 2 })),
    ];
    if (newPdfs.length > 0) {
      await tx.factoryFloorPdf.createMany({ data: newPdfs });
    }

    return site;
  });

  return serializeBigInt(result);
}

// ============ 削除 ============

export async function deleteSite(id: string) {
  const user = await requireSession();

  const site = await prisma.factoryFloor.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!site) throw new Error("現場が見つかりません");

  return prisma.factoryFloor.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ============ 複製 ============

export async function duplicateSite(id: string) {
  const user = await requireSession();

  const original = await prisma.factoryFloor.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
    include: {
      occupations: true,
      priceDetails: { where: { deletedAt: null } },
      images: { where: { deletedAt: null } },
      pdfs: { where: { deletedAt: null } },
    },
  });
  if (!original) throw new Error("現場が見つかりません");

  const result = await prisma.$transaction(async (tx) => {
    const site = await tx.factoryFloor.create({
      data: {
        createdUserId: user.id,
        companyId: user.companyId,
        status: "NOT_ORDERED",
        name: original.name ? `${original.name}（コピー）` : null,
        code: null,
        contentRequest: original.contentRequest,
        remarks: original.remarks,
        address: original.address,
        deliveryDest: original.deliveryDest,
        startDayRequest: original.startDayRequest,
        endDayRequest: original.endDayRequest,
        totalAmount: original.totalAmount,
        totalAdvancePayment: original.totalAdvancePayment,
        expenses: original.expenses,
        paymentType: original.paymentType,
        paymentLatterMonth: original.paymentLatterMonth,
        paymentLatterDay: original.paymentLatterDay,
      },
    });

    if (original.occupations.length > 0) {
      await tx.factoryFloorOccupation.createMany({
        data: original.occupations.map((o) => ({
          factoryFloorId: site.id,
          occupationSubItemId: o.occupationSubItemId,
        })),
      });
    }

    if (original.priceDetails.length > 0) {
      await tx.priceOrderDetail.createMany({
        data: original.priceDetails.map((d) => ({
          factoryFloorId: site.id,
          name: d.name,
          quantity: d.quantity,
          unitId: d.unitId,
          priceUnit: d.priceUnit,
          specifications: d.specifications,
        })),
      });
    }

    if (original.images.length > 0) {
      await tx.factoryFloorImage.createMany({
        data: original.images.map((img) => ({
          factoryFloorId: site.id,
          url: img.url,
          type: img.type,
        })),
      });
    }

    if (original.pdfs.length > 0) {
      await tx.factoryFloorPdf.createMany({
        data: original.pdfs.map((pdf) => ({
          factoryFloorId: site.id,
          url: pdf.url,
          type: pdf.type,
        })),
      });
    }

    await tx.factoryFloorMember.create({
      data: {
        factoryFloorId: site.id,
        userId: user.id,
        type: 1,
      },
    });

    return site;
  });

  return serializeBigInt(result);
}

// ============ 子現場一覧取得 ============

export async function getChildSites(parentId: string) {
  const user = await requireSession();

  const sites = await prisma.factoryFloor.findMany({
    where: {
      parentId,
      companyId: user.companyId,
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
    include: {
      workCompany: { select: { id: true, name: true } },
      orders: {
        where: { deletedAt: null },
        select: { id: true, status: true, actualAmount: true },
      },
      _count: { select: { members: true } },
    },
  });

  return serializeBigInt(sites);
}

// ============ プロジェクト予算管理 ============

export async function getProjectSummary(parentId: string) {
  const user = await requireSession();

  const parent = await prisma.factoryFloor.findFirst({
    where: {
      id: parentId,
      companyId: user.companyId,
      deletedAt: null,
      parentId: null,
    },
    select: { id: true, budget: true },
  });
  if (!parent) throw new Error("プロジェクトが見つかりません");

  const children = await prisma.factoryFloor.findMany({
    where: {
      parentId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      status: true,
      totalAmount: true,
      orders: {
        where: { deletedAt: null },
        select: { actualAmount: true, status: true },
      },
    },
  });

  // 発注合計（子現場の totalAmount 合計）
  const orderedTotal = children.reduce((sum, c) => {
    return sum + (c.totalAmount ? Number(c.totalAmount) : 0);
  }, 0);

  // 実績合計（完了済みオーダーの actualAmount 合計）
  const actualTotal = children.reduce((sum, c) => {
    return sum + c.orders.reduce((oSum, o) => {
      return oSum + (o.actualAmount ? Number(o.actualAmount) : 0);
    }, 0);
  }, 0);

  const budget = parent.budget ? Number(parent.budget) : 0;

  return {
    budget,
    orderedTotal,
    actualTotal,
    diff: budget - orderedTotal,
    childCount: children.length,
  };
}

// ============ マスタデータ ============

export async function getUnits() {
  return prisma.unit.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
}
