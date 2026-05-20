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

  // ================================================================
  // 請求書テスト用データ: 大和総合建設（発注者）× 三和電気設備（受注者）
  // 4月に15件の工事 + 納品書
  // ================================================================

  const IDS2 = {
    yamatoCompany: "test-company-yamato-sogo",
    sanwaCompany: "test-company-sanwa-denki",
    yamatoUser: "test-user-yamato",
    sanwaUser: "test-user-sanwa",
    subYamato: "test-sub-yamato",
    subSanwa: "test-sub-sanwa",
    parentFloor: "test-floor-nihonbashi-parent",
    chatRoom2: "test-chatroom-2",
    memberYamato: "test-member-yamato-room2",
    memberSanwa: "test-member-sanwa-room2",
  };

  // ---- Companies ----
  await prisma.company.upsert({
    where: { id: IDS2.yamatoCompany },
    update: {},
    create: {
      id: IDS2.yamatoCompany,
      adminCompanyId: IDS.adminCompany,
      name: "大和総合建設（株）",
      nameKana: "ヤマトソウゴウケンセツ",
      type: "ORDERER",
      companyForm: "CORPORATION",
      email: "info@yamato-sogo.co.jp",
      postalCode: "103-0023",
      prefecture: "東京都",
      city: "中央区",
      streetAddress: "日本橋本町3-5-12",
      telNumber: "03-5200-8800",
      bankName: "みずほ銀行",
      bankBranchName: "日本橋支店",
      bankAccountType: "ORDINARY",
      bankAccountNumber: "1234567",
      bankAccountName: "ダイワソウゴウケンセツ(カ",
      invoiceNumber: "T1234567890123",
      isActive: true,
      registrationStep: null,
      billingClosingDay: null,
      billingGraceDays: 5,
      paymentDueType: "NEXT_MONTH_END",
    },
  });
  await prisma.company.upsert({
    where: { id: IDS2.sanwaCompany },
    update: {},
    create: {
      id: IDS2.sanwaCompany,
      adminCompanyId: IDS.adminCompany,
      name: "（有）三和電気設備",
      nameKana: "サンワデンキセツビ",
      type: "CONTRACTOR",
      companyForm: "CORPORATION",
      email: "info@sanwa-denki.co.jp",
      postalCode: "136-0071",
      prefecture: "東京都",
      city: "江東区",
      streetAddress: "亀戸6-28-15",
      telNumber: "03-3685-4400",
      bankName: "三菱UFJ銀行",
      bankBranchName: "亀戸支店",
      bankAccountType: "ORDINARY",
      bankAccountNumber: "7654321",
      bankAccountName: "サンワデンキセツビ(ユ",
      invoiceNumber: "T9876543210987",
      isActive: true,
      registrationStep: null,
      selfIntro: "電気設備工事・空調設備工事を中心に30年の実績。オフィスビル・商業施設の改修工事に強みがあります。",
      yearsOfExperience: 30,
    },
  });
  console.log("  2 invoice-test companies created");

  // ---- Users ----
  await prisma.user.upsert({
    where: { id: IDS2.yamatoUser },
    update: {},
    create: {
      id: IDS2.yamatoUser,
      lastName: "大和",
      firstName: "健一",
      lastNameKana: "ヤマト",
      firstNameKana: "ケンイチ",
      email: "yamato@test.com",
      password: hashedPassword,
      role: "REPRESENTATIVE",
      companyId: IDS2.yamatoCompany,
      isActive: true,
      policyStatus: true,
    },
  });
  await prisma.user.upsert({
    where: { id: IDS2.sanwaUser },
    update: {},
    create: {
      id: IDS2.sanwaUser,
      lastName: "三和",
      firstName: "誠",
      lastNameKana: "ミワ",
      firstNameKana: "マコト",
      email: "sanwa@test.com",
      password: hashedPassword,
      role: "REPRESENTATIVE",
      companyId: IDS2.sanwaCompany,
      isActive: true,
      policyStatus: true,
    },
  });
  console.log("  2 invoice-test users created");

  // ---- Subscriptions ----
  await prisma.subscription.upsert({
    where: { companyId_planType: { companyId: IDS2.yamatoCompany, planType: "ORDERER" } },
    update: {},
    create: { id: IDS2.subYamato, companyId: IDS2.yamatoCompany, planType: "ORDERER", status: "TRIAL", trialEndsAt: trialEnd },
  });
  await prisma.subscription.upsert({
    where: { companyId_planType: { companyId: IDS2.sanwaCompany, planType: "CONTRACTOR" } },
    update: {},
    create: { id: IDS2.subSanwa, companyId: IDS2.sanwaCompany, planType: "CONTRACTOR", status: "TRIAL", trialEndsAt: trialEnd },
  });
  console.log("  2 invoice-test subscriptions created");

  // ---- CompanyOccupation ----
  await prisma.companyOccupation.upsert({
    where: { id: "test-occ-sanwa" },
    update: {},
    create: { id: "test-occ-sanwa", companyId: IDS2.sanwaCompany, occupationSubItemId: "設備（電気）__電気工事" },
  });

  // ---- Parent FactoryFloor (プロジェクト) ----
  await prisma.factoryFloor.upsert({
    where: { id: IDS2.parentFloor },
    update: {},
    create: {
      id: IDS2.parentFloor,
      createdUserId: IDS2.yamatoUser,
      companyId: IDS2.yamatoCompany,
      status: "IN_PROGRESS",
      name: "日本橋三丁目オフィスビル改修工事",
      code: "NHB-2026-001",
      address: "東京都中央区日本橋3-10-5",
      latitude: 35.6812,
      longitude: 139.7741,
      startDayRequest: new Date("2026-03-15"),
      endDayRequest: new Date("2026-07-31"),
      contentRequest: "築25年のオフィスビル全面改修。電気設備・空調設備・照明の入替工事。3F〜5F各フロア及び共用部の設備更新を行う。",
      budget: BigInt(25000000),
    },
  });

  // ---- FactoryFloorMember ----
  await prisma.factoryFloorMember.upsert({
    where: { id: "test-floor-member-yamato" },
    update: {},
    create: { id: "test-floor-member-yamato", userId: IDS2.yamatoUser, factoryFloorId: IDS2.parentFloor, type: 1 },
  });

  // ---- 15 child construction sites ----
  const childWorks = [
    { idx: 1,  name: "3F 分電盤交換工事",             amount: 680000,   day: 3,  details: [{ name: "分電盤撤去・新設", qty: 1, unit: "式", price: 480000 }, { name: "配線接続工事", qty: 1, unit: "式", price: 200000 }] },
    { idx: 2,  name: "3F 照明器具LED化工事",           amount: 1250000,  day: 5,  details: [{ name: "既存照明撤去", qty: 48, unit: "台", price: 5000 }, { name: "LED照明器具取付", qty: 48, unit: "台", price: 18000 }, { name: "配線改修", qty: 1, unit: "式", price: 186000 }] },
    { idx: 3,  name: "3F 空調室内機入替工事",          amount: 2180000,  day: 7,  details: [{ name: "既存室内機撤去", qty: 8, unit: "台", price: 30000 }, { name: "新規室内機設置", qty: 8, unit: "台", price: 220000 }, { name: "冷媒配管接続", qty: 8, unit: "台", price: 12500 }] },
    { idx: 4,  name: "4F 分電盤交換工事",             amount: 680000,   day: 8,  details: [{ name: "分電盤撤去・新設", qty: 1, unit: "式", price: 480000 }, { name: "配線接続工事", qty: 1, unit: "式", price: 200000 }] },
    { idx: 5,  name: "4F 照明器具LED化工事",           amount: 1320000,  day: 10, details: [{ name: "既存照明撤去", qty: 52, unit: "台", price: 5000 }, { name: "LED照明器具取付", qty: 52, unit: "台", price: 18000 }, { name: "配線改修", qty: 1, unit: "式", price: 124000 }] },
    { idx: 6,  name: "4F 空調室内機入替工事",          amount: 2180000,  day: 11, details: [{ name: "既存室内機撤去", qty: 8, unit: "台", price: 30000 }, { name: "新規室内機設置", qty: 8, unit: "台", price: 220000 }, { name: "冷媒配管接続", qty: 8, unit: "台", price: 12500 }] },
    { idx: 7,  name: "4F コンセント増設工事",          amount: 450000,   day: 14, details: [{ name: "コンセント新設", qty: 15, unit: "箇所", price: 18000 }, { name: "配線・配管工事", qty: 1, unit: "式", price: 180000 }] },
    { idx: 8,  name: "5F 分電盤交換工事",             amount: 720000,   day: 15, details: [{ name: "分電盤撤去・新設", qty: 1, unit: "式", price: 520000 }, { name: "配線接続工事", qty: 1, unit: "式", price: 200000 }] },
    { idx: 9,  name: "5F 照明器具LED化工事",           amount: 1380000,  day: 17, details: [{ name: "既存照明撤去", qty: 56, unit: "台", price: 5000 }, { name: "LED照明器具取付", qty: 56, unit: "台", price: 18000 }, { name: "配線改修", qty: 1, unit: "式", price: 92000 }] },
    { idx: 10, name: "5F 空調室内機入替工事",          amount: 2350000,  day: 18, details: [{ name: "既存室内機撤去", qty: 10, unit: "台", price: 30000 }, { name: "新規室内機設置", qty: 10, unit: "台", price: 195000 }, { name: "冷媒配管接続", qty: 10, unit: "台", price: 10000 }] },
    { idx: 11, name: "5F OAフロア配線工事",           amount: 890000,   day: 21, details: [{ name: "OAフロア内配線", qty: 120, unit: "m", price: 4500 }, { name: "フロアコンセント設置", qty: 20, unit: "箇所", price: 17500 }] },
    { idx: 12, name: "共用部 非常灯交換工事",          amount: 560000,   day: 22, details: [{ name: "非常灯撤去", qty: 24, unit: "台", price: 3000 }, { name: "LED非常灯設置", qty: 24, unit: "台", price: 15000 }, { name: "バッテリー点検", qty: 24, unit: "台", price: 5333 }] },
    { idx: 13, name: "共用部 防災設備点検・修繕",      amount: 1150000,  day: 24, details: [{ name: "自動火災報知設備点検", qty: 1, unit: "式", price: 350000 }, { name: "感知器交換", qty: 32, unit: "個", price: 12500 }, { name: "非常放送設備点検・修繕", qty: 1, unit: "式", price: 400000 }] },
    { idx: 14, name: "EV機械室 動力盤更新工事",        amount: 1980000,  day: 25, details: [{ name: "既存動力盤撤去", qty: 1, unit: "式", price: 280000 }, { name: "新規動力盤設置", qty: 1, unit: "式", price: 1400000 }, { name: "配線・結線工事", qty: 1, unit: "式", price: 300000 }] },
    { idx: 15, name: "屋上 キュービクル点検・部品交換", amount: 3200000,  day: 28, details: [{ name: "キュービクル精密点検", qty: 1, unit: "式", price: 800000 }, { name: "VCB交換", qty: 2, unit: "台", price: 650000 }, { name: "変圧器絶縁油交換", qty: 3, unit: "台", price: 200000 }, { name: "接地抵抗測定・改修", qty: 1, unit: "式", price: 500000 }] },
  ];

  for (const work of childWorks) {
    const floorId = `test-floor-nhb-child-${work.idx}`;
    const orderId = `test-order-nhb-${work.idx}`;
    const reportId = `test-report-nhb-${work.idx}`;
    const docOrderId = `test-doc-ord-nhb-${work.idx}`;
    const docDlvId = `test-doc-dlv-nhb-${work.idx}`;
    const taxAmount = Math.ceil(work.amount * 0.1);
    const totalAmount = work.amount + taxAmount;
    const deliveryDate = new Date(`2026-04-${String(work.day).padStart(2, "0")}`);

    // Child FactoryFloor
    await prisma.factoryFloor.upsert({
      where: { id: floorId },
      update: {},
      create: {
        id: floorId,
        createdUserId: IDS2.yamatoUser,
        companyId: IDS2.yamatoCompany,
        workCompanyId: IDS2.sanwaCompany,
        parentId: IDS2.parentFloor,
        status: "DELIVERY_APPROVED",
        name: work.name,
        address: "東京都中央区日本橋3-10-5",
        startDayRequest: new Date(`2026-04-${String(Math.max(1, work.day - 5)).padStart(2, "0")}`),
        endDayRequest: deliveryDate,
        contentRequest: work.name,
        totalAmount: BigInt(work.amount),
      },
    });

    // PriceOrderDetails
    for (let d = 0; d < work.details.length; d++) {
      const detail = work.details[d];
      await prisma.priceOrderDetail.upsert({
        where: { id: `test-price-nhb-${work.idx}-${d + 1}` },
        update: {},
        create: {
          id: `test-price-nhb-${work.idx}-${d + 1}`,
          factoryFloorId: floorId,
          name: detail.name,
          quantity: detail.qty,
          unitId: detail.unit,
          priceUnit: BigInt(detail.price),
        },
      });
    }

    // FactoryFloorOrder
    await prisma.factoryFloorOrder.upsert({
      where: { id: orderId },
      update: {},
      create: {
        id: orderId,
        factoryFloorId: floorId,
        workCompanyId: IDS2.sanwaCompany,
        status: "CONFIRMED",
        actualAmount: BigInt(totalAmount),
      },
    });

    // CompletionReport
    await prisma.completionReport.upsert({
      where: { factoryFloorOrderId: orderId },
      update: {},
      create: {
        id: reportId,
        factoryFloorOrderId: orderId,
        completionDate: deliveryDate,
        comment: `${work.name}が完了しました。検査・通電確認済みです。`,
        photos: ["/uploads/test/completion-photo-1.jpg"],
        hasAdditionalWork: false,
      },
    });

    // Document: ORDER_SHEET
    await prisma.document.upsert({
      where: { id: docOrderId },
      update: {},
      create: {
        id: docOrderId,
        type: "ORDER_SHEET",
        status: "ISSUED",
        documentNumber: `ORD-NHB-202604-${String(work.idx).padStart(4, "0")}`,
        factoryFloorOrderId: orderId,
        orderCompanyId: IDS2.yamatoCompany,
        workerCompanyId: IDS2.sanwaCompany,
        subtotal: BigInt(work.amount),
        taxAmount: BigInt(taxAmount),
        totalAmount: BigInt(totalAmount),
        issuedAt: new Date(`2026-04-${String(Math.max(1, work.day - 5)).padStart(2, "0")}`),
        metadata: { siteName: `日本橋三丁目オフィスビル改修工事 ${work.name}` },
      },
    });

    // Document: DELIVERY_NOTE
    await prisma.document.upsert({
      where: { id: docDlvId },
      update: {},
      create: {
        id: docDlvId,
        type: "DELIVERY_NOTE",
        status: "ISSUED",
        documentNumber: `DLV-NHB-202604-${String(work.idx).padStart(4, "0")}`,
        factoryFloorOrderId: orderId,
        orderCompanyId: IDS2.yamatoCompany,
        workerCompanyId: IDS2.sanwaCompany,
        subtotal: BigInt(work.amount),
        taxAmount: BigInt(taxAmount),
        totalAmount: BigInt(totalAmount),
        issuedAt: deliveryDate,
        yearMonth: "202604",
        metadata: { siteName: `日本橋三丁目オフィスビル改修工事 ${work.name}` },
      },
    });
  }
  console.log("  15 child works + orders + documents created");

  // ---- ChatRoom ----
  await prisma.chatRoom.upsert({
    where: { id: IDS2.chatRoom2 },
    update: {},
    create: {
      id: IDS2.chatRoom2,
      orderCompanyId: IDS2.yamatoCompany,
      workerCompanyId: IDS2.sanwaCompany,
      factoryFloorId: IDS2.parentFloor,
      type: "SITE_INFO",
      status: "OPEN",
      lastMessageTime: new Date("2026-04-28T17:00:00Z"),
    },
  });
  await prisma.chatRoomMember.upsert({
    where: { id: IDS2.memberYamato },
    update: {},
    create: { id: IDS2.memberYamato, roomId: IDS2.chatRoom2, userId: IDS2.yamatoUser, roleUser: 1, unreadCount: 0 },
  });
  await prisma.chatRoomMember.upsert({
    where: { id: IDS2.memberSanwa },
    update: {},
    create: { id: IDS2.memberSanwa, roomId: IDS2.chatRoom2, userId: IDS2.sanwaUser, roleUser: 2, unreadCount: 0 },
  });
  console.log("  Invoice-test ChatRoom created");

  console.log("--- Test data seeding completed ---\n");
  console.log("Test accounts:");
  console.log("  yamada@test.com  / password123 (orderer - Yamada Kensetsu)");
  console.log("  sato@test.com    / password123 (orderer - Sato Koumuten)");
  console.log("  suzuki@test.com  / password123 (contractor - Suzuki Denki)");
  console.log("  tanaka@test.com  / password123 (contractor - Tanaka Tosou)");
  console.log("  yamato@test.com  / password123 (orderer - Yamato Sogo Kensetsu)");
  console.log("  sanwa@test.com   / password123 (contractor - Sanwa Denki Setsubi)");
}
