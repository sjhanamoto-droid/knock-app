import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// ============ Fixed IDs for reproducibility ============
const ADMIN_COMPANY_ID = "cmmc0eyld0000c9ozfkn3v26y";

const IDS = {
  adminCompany: ADMIN_COMPANY_ID,
  // Companies
  yamadaCompany: "test-company-yamada-kensetsu",
  satoCompany: "test-company-sato-koumuten",
  suzukiCompany: "test-company-suzuki-denki",
  tanakaCompany: "test-company-tanaka-tosou",
  // Users
  yamadaUser: "test-user-yamada",
  satoUser: "test-user-sato",
  suzukiUser: "test-user-suzuki",
  tanakaUser: "test-user-tanaka",
  // FactoryFloors
  floor1: "test-floor-shinjuku",
  floor2: "test-floor-shibuya",
  // Orders
  order1: "test-order-1",
  order2: "test-order-2",
  // ChatRooms
  chatRoom1: "test-chatroom-1",
  // Messages
  msg1: "test-msg-1",
  msg2: "test-msg-2",
  msg3: "test-msg-3",
  // ChatRoomMembers
  member1: "test-member-yamada-room1",
  member2: "test-member-suzuki-room1",
  // JobPostings
  job1: "test-job-1",
  job2: "test-job-2",
  // CompletionReport
  report1: "test-report-1",
  // Subscriptions
  subYamada: "test-sub-yamada",
  subSato: "test-sub-sato",
  subSuzuki: "test-sub-suzuki",
  subTanaka: "test-sub-tanaka",
  // CompanyOccupations
  occSuzuki: "test-occ-suzuki",
  occTanaka: "test-occ-tanaka",
  // FactoryFloorMembers
  floorMember1: "test-floor-member-1",
  floorMember2: "test-floor-member-2",
  // Documents
  doc1: "test-doc-order-sheet-1",
  doc2: "test-doc-delivery-note-1",
};

export async function seedTestData(prisma: PrismaClient) {
  console.log("\n--- Seeding test data ---");

  const hashedPassword = await bcrypt.hash("password123", 12);

  // ============ AdminCompany ============
  await prisma.adminCompany.upsert({
    where: { id: IDS.adminCompany },
    update: {},
    create: {
      id: IDS.adminCompany,
      name: "Knock管理会社",
      email: "admin@knock.co.jp",
    },
  });
  console.log("  AdminCompany created");

  // ============ Companies ============
  const companies = [
    {
      id: IDS.yamadaCompany,
      name: "山田建設（株）",
      nameKana: "ヤマダケンセツ",
      type: "ORDERER" as const,
      companyForm: "CORPORATION" as const,
      email: "info@yamada-kensetsu.co.jp",
      prefecture: "東京都",
      city: "新宿区",
      streetAddress: "西新宿1-1-1",
      telNumber: "03-1111-1111",
      isActive: true,
      registrationStep: null,
    },
    {
      id: IDS.satoCompany,
      name: "佐藤工務店",
      nameKana: "サトウコウムテン",
      type: "ORDERER" as const,
      companyForm: "INDIVIDUAL" as const,
      email: "info@sato-koumuten.co.jp",
      prefecture: "東京都",
      city: "渋谷区",
      streetAddress: "渋谷2-2-2",
      telNumber: "03-2222-2222",
      isActive: true,
      registrationStep: null,
    },
    {
      id: IDS.suzukiCompany,
      name: "鈴木電気（株）",
      nameKana: "スズキデンキ",
      type: "CONTRACTOR" as const,
      companyForm: "CORPORATION" as const,
      email: "info@suzuki-denki.co.jp",
      prefecture: "東京都",
      city: "品川区",
      streetAddress: "大崎3-3-3",
      telNumber: "03-3333-3333",
      isActive: true,
      registrationStep: null,
      selfIntro: "電気工事を中心に20年の実績があります。",
      yearsOfExperience: 20,
    },
    {
      id: IDS.tanakaCompany,
      name: "田中塗装",
      nameKana: "タナカトソウ",
      type: "CONTRACTOR" as const,
      companyForm: "INDIVIDUAL" as const,
      email: "info@tanaka-tosou.co.jp",
      prefecture: "神奈川県",
      city: "横浜市中区",
      streetAddress: "本町4-4-4",
      telNumber: "045-4444-4444",
      isActive: true,
      registrationStep: null,
      selfIntro: "内装・外装塗装の専門店です。丁寧な仕事を心がけています。",
      yearsOfExperience: 15,
    },
  ];

  for (const c of companies) {
    await prisma.company.upsert({
      where: { id: c.id },
      update: {},
      create: {
        ...c,
        adminCompanyId: IDS.adminCompany,
      },
    });
  }
  console.log(`  ${companies.length} companies created`);

  // ============ Users ============
  const users = [
    {
      id: IDS.yamadaUser,
      lastName: "山田",
      firstName: "太郎",
      lastNameKana: "ヤマダ",
      firstNameKana: "タロウ",
      email: "yamada@test.com",
      password: hashedPassword,
      role: "REPRESENTATIVE" as const,
      companyId: IDS.yamadaCompany,
      isActive: true,
      policyStatus: true,
    },
    {
      id: IDS.satoUser,
      lastName: "佐藤",
      firstName: "花子",
      lastNameKana: "サトウ",
      firstNameKana: "ハナコ",
      email: "sato@test.com",
      password: hashedPassword,
      role: "REPRESENTATIVE" as const,
      companyId: IDS.satoCompany,
      isActive: true,
      policyStatus: true,
    },
    {
      id: IDS.suzukiUser,
      lastName: "鈴木",
      firstName: "一郎",
      lastNameKana: "スズキ",
      firstNameKana: "イチロウ",
      email: "suzuki@test.com",
      password: hashedPassword,
      role: "REPRESENTATIVE" as const,
      companyId: IDS.suzukiCompany,
      isActive: true,
      policyStatus: true,
    },
    {
      id: IDS.tanakaUser,
      lastName: "田中",
      firstName: "次郎",
      lastNameKana: "タナカ",
      firstNameKana: "ジロウ",
      email: "tanaka@test.com",
      password: hashedPassword,
      role: "REPRESENTATIVE" as const,
      companyId: IDS.tanakaCompany,
      isActive: true,
      policyStatus: true,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: u,
    });
  }
  console.log(`  ${users.length} users created`);

  // ============ Subscriptions (TRIAL) ============
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 30);

  const subscriptions = [
    { id: IDS.subYamada, companyId: IDS.yamadaCompany, planType: "ORDERER" as const },
    { id: IDS.subSato, companyId: IDS.satoCompany, planType: "ORDERER" as const },
    { id: IDS.subSuzuki, companyId: IDS.suzukiCompany, planType: "CONTRACTOR" as const },
    { id: IDS.subTanaka, companyId: IDS.tanakaCompany, planType: "CONTRACTOR" as const },
  ];

  for (const sub of subscriptions) {
    await prisma.subscription.upsert({
      where: { companyId_planType: { companyId: sub.companyId, planType: sub.planType } },
      update: {},
      create: {
        ...sub,
        status: "TRIAL",
        trialEndsAt: trialEnd,
      },
    });
  }
  console.log(`  ${subscriptions.length} subscriptions created`);

  // ============ CompanyOccupation (contractors) ============
  await prisma.companyOccupation.upsert({
    where: { id: IDS.occSuzuki },
    update: {},
    create: {
      id: IDS.occSuzuki,
      companyId: IDS.suzukiCompany,
      occupationSubItemId: "設備（電気）__電気工事",
    },
  });
  await prisma.companyOccupation.upsert({
    where: { id: IDS.occTanaka },
    update: {},
    create: {
      id: IDS.occTanaka,
      companyId: IDS.tanakaCompany,
      occupationSubItemId: "屋根・外壁__塗装工（外装）",
    },
  });
  console.log("  CompanyOccupations created");

  // ============ FactoryFloors (sites) ============
  await prisma.factoryFloor.upsert({
    where: { id: IDS.floor1 },
    update: {},
    create: {
      id: IDS.floor1,
      createdUserId: IDS.yamadaUser,
      companyId: IDS.yamadaCompany,
      workCompanyId: IDS.suzukiCompany,
      status: "IN_PROGRESS",
      name: "新宿オフィスビル電気工事",
      address: "東京都新宿区西新宿2-8-1",
      latitude: 35.6896,
      longitude: 139.6921,
      startDayRequest: new Date("2026-03-01"),
      endDayRequest: new Date("2026-05-31"),
      contentRequest: "オフィスビル3階〜5階の電気配線工事",
    },
  });

  await prisma.factoryFloor.upsert({
    where: { id: IDS.floor2 },
    update: {},
    create: {
      id: IDS.floor2,
      createdUserId: IDS.satoUser,
      companyId: IDS.satoCompany,
      workCompanyId: IDS.tanakaCompany,
      status: "ORDER_REQUESTED",
      name: "渋谷マンション外壁塗装",
      address: "東京都渋谷区神宮前5-10-1",
      latitude: 35.6654,
      longitude: 139.7071,
      startDayRequest: new Date("2026-04-15"),
      endDayRequest: new Date("2026-06-30"),
      contentRequest: "マンション外壁全面の塗装工事（足場設置含む）",
    },
  });
  console.log("  2 factory floors created");

  // ============ FactoryFloorMembers ============
  await prisma.factoryFloorMember.upsert({
    where: { id: IDS.floorMember1 },
    update: {},
    create: {
      id: IDS.floorMember1,
      userId: IDS.yamadaUser,
      factoryFloorId: IDS.floor1,
      type: 1,
    },
  });
  await prisma.factoryFloorMember.upsert({
    where: { id: IDS.floorMember2 },
    update: {},
    create: {
      id: IDS.floorMember2,
      userId: IDS.satoUser,
      factoryFloorId: IDS.floor2,
      type: 1,
    },
  });
  console.log("  FactoryFloorMembers created");

  // ============ FactoryFloorOrders ============
  await prisma.factoryFloorOrder.upsert({
    where: { id: IDS.order1 },
    update: {},
    create: {
      id: IDS.order1,
      factoryFloorId: IDS.floor1,
      workCompanyId: IDS.suzukiCompany,
      status: "CONFIRMED",
      actualAmount: BigInt(3500000),
    },
  });
  await prisma.factoryFloorOrder.upsert({
    where: { id: IDS.order2 },
    update: {},
    create: {
      id: IDS.order2,
      factoryFloorId: IDS.floor2,
      workCompanyId: IDS.tanakaCompany,
      status: "PENDING",
    },
  });
  console.log("  2 orders created");

  // ============ Documents (order sheet + delivery note) ============
  await prisma.document.upsert({
    where: { id: IDS.doc1 },
    update: {},
    create: {
      id: IDS.doc1,
      type: "ORDER_SHEET",
      status: "ISSUED",
      documentNumber: "ORD-2026-0001",
      factoryFloorOrderId: IDS.order1,
      orderCompanyId: IDS.yamadaCompany,
      workerCompanyId: IDS.suzukiCompany,
      subtotal: BigInt(3500000),
      taxAmount: BigInt(350000),
      totalAmount: BigInt(3850000),
      issuedAt: new Date("2026-03-01"),
    },
  });
  await prisma.document.upsert({
    where: { id: IDS.doc2 },
    update: {},
    create: {
      id: IDS.doc2,
      type: "DELIVERY_NOTE",
      status: "ISSUED",
      documentNumber: "DLV-2026-0001",
      factoryFloorOrderId: IDS.order1,
      orderCompanyId: IDS.yamadaCompany,
      workerCompanyId: IDS.suzukiCompany,
      subtotal: BigInt(3500000),
      taxAmount: BigInt(350000),
      totalAmount: BigInt(3850000),
      issuedAt: new Date("2026-03-25"),
      yearMonth: "202603",
    },
  });
  console.log("  2 documents created");

  // ============ ChatRoom + Members + Messages ============
  await prisma.chatRoom.upsert({
    where: { id: IDS.chatRoom1 },
    update: {},
    create: {
      id: IDS.chatRoom1,
      orderCompanyId: IDS.yamadaCompany,
      workerCompanyId: IDS.suzukiCompany,
      factoryFloorId: IDS.floor1,
      type: "SITE_INFO",
      status: "OPEN",
      lastMessageTime: new Date("2026-03-30T10:30:00Z"),
    },
  });

  await prisma.chatRoomMember.upsert({
    where: { id: IDS.member1 },
    update: {},
    create: {
      id: IDS.member1,
      roomId: IDS.chatRoom1,
      userId: IDS.yamadaUser,
      roleUser: 1,
      unreadCount: 1,
    },
  });
  await prisma.chatRoomMember.upsert({
    where: { id: IDS.member2 },
    update: {},
    create: {
      id: IDS.member2,
      roomId: IDS.chatRoom1,
      userId: IDS.suzukiUser,
      roleUser: 2,
      unreadCount: 0,
    },
  });

  await prisma.message.upsert({
    where: { id: IDS.msg1 },
    update: {},
    create: {
      id: IDS.msg1,
      roomId: IDS.chatRoom1,
      userId: IDS.yamadaUser,
      message: "電気工事の件、3階から着手でお願いします。",
      type: "TEXT",
      createdAt: new Date("2026-03-28T09:00:00Z"),
    },
  });
  await prisma.message.upsert({
    where: { id: IDS.msg2 },
    update: {},
    create: {
      id: IDS.msg2,
      roomId: IDS.chatRoom1,
      userId: IDS.suzukiUser,
      message: "承知しました。3月30日から3階の配線工事を開始します。",
      type: "TEXT",
      createdAt: new Date("2026-03-28T10:00:00Z"),
    },
  });
  await prisma.message.upsert({
    where: { id: IDS.msg3 },
    update: {},
    create: {
      id: IDS.msg3,
      roomId: IDS.chatRoom1,
      userId: IDS.suzukiUser,
      message: "資材の搬入は前日の29日に行います。駐車場の確保をお願いできますか？",
      type: "TEXT",
      createdAt: new Date("2026-03-30T10:30:00Z"),
    },
  });
  console.log("  ChatRoom + 3 messages created");

  // ============ JobPostings (published, with lat/lng for map) ============
  await prisma.jobPosting.upsert({
    where: { id: IDS.job1 },
    update: {},
    create: {
      id: IDS.job1,
      companyId: IDS.yamadaCompany,
      factoryFloorId: IDS.floor1,
      occupationSubItemId: "設備（電気）__電気工事",
      title: "【急募】新宿オフィスビル 電気工事作業員",
      description:
        "新宿エリアのオフィスビル電気配線工事です。3階〜5階のフロア配線を担当していただきます。経験者優遇。",
      requirements: "第二種電気工事士以上",
      compensationType: "DAILY",
      compensationAmount: BigInt(25000),
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-05-31"),
      address: "東京都新宿区西新宿2-8-1",
      latitude: 35.6896,
      longitude: 139.6921,
      status: "PUBLISHED",
    },
  });
  await prisma.jobPosting.upsert({
    where: { id: IDS.job2 },
    update: {},
    create: {
      id: IDS.job2,
      companyId: IDS.satoCompany,
      occupationSubItemId: "屋根・外壁__塗装工（外装）",
      title: "渋谷マンション 外壁塗装工募集",
      description:
        "渋谷エリアのマンション外壁塗装工事です。足場設置済みの現場での作業となります。",
      compensationType: "LUMP_SUM",
      compensationAmount: BigInt(800000),
      startDate: new Date("2026-04-15"),
      endDate: new Date("2026-06-30"),
      address: "東京都渋谷区神宮前5-10-1",
      latitude: 35.6654,
      longitude: 139.7071,
      status: "PUBLISHED",
    },
  });
  console.log("  2 job postings created");

  // ============ CompletionReport ============
  await prisma.completionReport.upsert({
    where: { factoryFloorOrderId: IDS.order1 },
    update: {},
    create: {
      id: IDS.report1,
      factoryFloorOrderId: IDS.order1,
      completionDate: new Date("2026-03-25"),
      comment: "3階〜5階の電気配線工事が完了しました。全フロアの通電確認済みです。",
      photos: ["/uploads/test/completion-photo-1.jpg", "/uploads/test/completion-photo-2.jpg"],
      hasAdditionalWork: false,
    },
  });
  console.log("  CompletionReport created");

  console.log("--- Test data seeding completed ---\n");
  console.log("Test accounts:");
  console.log("  yamada@test.com / password123 (orderer - Yamada Kensetsu)");
  console.log("  sato@test.com   / password123 (orderer - Sato Koumuten)");
  console.log("  suzuki@test.com / password123 (contractor - Suzuki Denki)");
  console.log("  tanaka@test.com / password123 (contractor - Tanaka Tosou)");
}
