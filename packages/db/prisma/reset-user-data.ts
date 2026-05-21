/**
 * ユーザー側テストデータを全削除するスクリプト
 * AdminCompany / AdminUser / マスタデータは保持する
 *
 * Usage: npx tsx prisma/reset-user-data.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== ユーザーデータのリセットを開始 ===\n");

  // 依存関係の深い順（リーフから）に削除
  const deleteOps: { label: string; fn: () => Promise<unknown> }[] = [
    // Level 0: Leaf tables
    { label: "DeviceToken", fn: () => prisma.deviceToken.deleteMany() },
    { label: "UserVerification", fn: () => prisma.userVerification.deleteMany() },
    { label: "UserQualification", fn: () => prisma.userQualification.deleteMany() },
    { label: "Notification", fn: () => prisma.notification.deleteMany() },
    { label: "ChatRoomMember", fn: () => prisma.chatRoomMember.deleteMany() },
    { label: "TemplateMessage", fn: () => prisma.templateMessage.deleteMany() },
    { label: "CompanyInsurance", fn: () => prisma.companyInsurance.deleteMany() },
    { label: "CompanyArea", fn: () => prisma.companyArea.deleteMany() },
    { label: "CompanyOccupation", fn: () => prisma.companyOccupation.deleteMany() },
    { label: "AvailabilitySlot", fn: () => prisma.availabilitySlot.deleteMany() },
    { label: "FactoryFloorImage", fn: () => prisma.factoryFloorImage.deleteMany() },
    { label: "FactoryFloorOccupation", fn: () => prisma.factoryFloorOccupation.deleteMany() },
    { label: "FactoryFloorMember", fn: () => prisma.factoryFloorMember.deleteMany() },

    // Level 1: Direct children
    { label: "Message", fn: () => prisma.message.deleteMany() },
    { label: "TmpReport", fn: () => prisma.tmpReport.deleteMany() },
    { label: "FactoryFloorPdf", fn: () => prisma.factoryFloorPdf.deleteMany() },
    { label: "PriceOrderDetail", fn: () => prisma.priceOrderDetail.deleteMany() },
    { label: "JobApplication", fn: () => prisma.jobApplication.deleteMany() },
    { label: "Matching", fn: () => prisma.matching.deleteMany() },
    { label: "Invited", fn: () => prisma.invited.deleteMany() },
    { label: "CompanyContractPdf", fn: () => prisma.companyContractPdf.deleteMany() },

    // Level 2: Intermediate
    { label: "BillingRequestDetail", fn: () => prisma.billingRequestDetail.deleteMany() },
    { label: "AdditionalOrder", fn: () => prisma.additionalOrder.deleteMany() },
    { label: "BillingRequest", fn: () => prisma.billingRequest.deleteMany() },
    { label: "CompletionReport", fn: () => prisma.completionReport.deleteMany() },
    { label: "Document", fn: () => prisma.document.deleteMany() },
    { label: "Evaluation", fn: () => prisma.evaluation.deleteMany() },
    { label: "ChatRoom", fn: () => prisma.chatRoom.deleteMany() },

    // Level 2.5: Orders (after their children)
    { label: "FactoryFloorOrder", fn: () => prisma.factoryFloorOrder.deleteMany() },

    // Level 3: Job postings, invoices, etc.
    { label: "JobPosting", fn: () => prisma.jobPosting.deleteMany() },
    { label: "Invoice", fn: () => prisma.invoice.deleteMany() },
    { label: "CompanyContract", fn: () => prisma.companyContract.deleteMany() },
    { label: "TrustScore", fn: () => prisma.trustScore.deleteMany() },
    { label: "PaymentInfo", fn: () => prisma.paymentInfo.deleteMany() },
    { label: "Subscription", fn: () => prisma.subscription.deleteMany() },

    // Level 4: FactoryFloor (self-referential: children first)
    // 子工事を先に削除してから親工事を削除
    {
      label: "FactoryFloor (children)",
      fn: () => prisma.factoryFloor.deleteMany({ where: { parentId: { not: null } } }),
    },
    {
      label: "FactoryFloor (parents)",
      fn: () => prisma.factoryFloor.deleteMany(),
    },

    // Level 5: Users & Companies
    { label: "User", fn: () => prisma.user.deleteMany() },
    { label: "Company", fn: () => prisma.company.deleteMany() },
  ];

  for (const op of deleteOps) {
    try {
      const result = await op.fn();
      const count = (result as { count?: number }).count ?? 0;
      if (count > 0) {
        console.log(`  ✓ ${op.label}: ${count}件削除`);
      } else {
        console.log(`  - ${op.label}: 0件`);
      }
    } catch (e) {
      console.error(`  ✗ ${op.label}: エラー - ${(e as Error).message}`);
    }
  }

  console.log("\n=== リセット完了 ===");
  console.log("保持: AdminCompany, AdminUser, マスタデータ（Unit, Tax, Area, 資格, 職種）");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
