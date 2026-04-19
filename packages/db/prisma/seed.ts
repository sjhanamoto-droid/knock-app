import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ============ Units (単位マスタ) ============
  const units = [
    "式",
    "m",
    "㎡",
    "㎥",
    "t",
    "kg",
    "本",
    "枚",
    "個",
    "台",
    "基",
    "箇所",
    "セット",
    "人",
    "人工",
    "日",
    "月",
    "回",
    "件",
    "組",
    "面",
    "巻",
    "缶",
    "袋",
    "箱",
    "束",
    "冊",
    "対",
    "双",
    "一式",
  ];

  for (const name of units) {
    await prisma.unit.upsert({
      where: { id: name },
      update: {},
      create: { id: name, name },
    });
  }
  console.log(`✓ ${units.length} units seeded`);

  // ============ Tax Master (税率マスタ) ============
  const taxes = [
    { name: "消費税10%", percentage: 10.0 },
    { name: "軽減税率8%", percentage: 8.0 },
    { name: "非課税", percentage: 0.0 },
  ];

  for (const tax of taxes) {
    await prisma.taxMaster.upsert({
      where: { id: tax.name },
      update: {},
      create: { id: tax.name, name: tax.name, percentage: tax.percentage },
    });
  }
  console.log(`✓ ${taxes.length} tax rates seeded`);

  // ============ Areas (エリアマスタ) ============
  const areas = [
    { serialNumber: 1, name: "北海道" },
    { serialNumber: 2, name: "東北" },
    { serialNumber: 3, name: "関東" },
    { serialNumber: 4, name: "中部" },
    { serialNumber: 5, name: "近畿" },
    { serialNumber: 6, name: "中国" },
    { serialNumber: 7, name: "四国" },
    { serialNumber: 8, name: "九州・沖縄" },
  ];

  for (const area of areas) {
    await prisma.area.upsert({
      where: { id: area.name },
      update: {},
      create: { id: area.name, ...area },
    });
  }
  console.log(`✓ ${areas.length} areas seeded`);

  // ============ Other Insurance (その他保険マスタ) ============
  // Note: OtherInsurance model does not exist in schema; skipping.

  // ============ Occupation Masters (職種マスタ) ============
  const occupations: { major: string; subs: string[] }[] = [
    {
      major: "土木",
      subs: ["土工", "舗装工", "重機オペレーター", "法面工", "土木鳶", "しゅんせつ工", "さく井工"],
    },
    {
      major: "建築（躯体）",
      subs: ["足場鳶", "鉄骨鳶", "鉄筋工", "型枠大工", "コンクリート圧送工", "左官", "大工"],
    },
    {
      major: "屋根・外壁",
      subs: ["屋根工", "防水工", "建築板金工", "塗装工（外装）"],
    },
    {
      major: "内装・仕上げ",
      subs: ["軽天・ボード工（LGS）", "クロス工", "造作大工", "塗装工（内装）", "床仕上げ工", "タイル工", "建具工", "ガラス工", "石工"],
    },
    {
      major: "設備（電気）",
      subs: ["電気工事", "電気通信工事", "消防施設工事"],
    },
    {
      major: "設備（管・空調）",
      subs: ["給排水・衛生設備", "空調・ダクト工事", "ガス配管工事", "保温・断熱工事"],
    },
    {
      major: "外構・造園",
      subs: ["外構工事（エクステリア）", "ブロック・石積み工事", "造園工事", "フェンス・門扉工事"],
    },
    {
      major: "解体・その他",
      subs: ["解体工事", "産業廃棄物処理", "クリーニング", "機械器具設置"],
    },
    {
      major: "管理・設計",
      subs: ["施工管理", "設計（建築士）", "積算", "安全管理"],
    },
  ];

  let majorCount = 0;
  let subCount = 0;

  for (const { major, subs } of occupations) {
    const majorItem = await prisma.occupationMajorItem.upsert({
      where: { id: major },
      update: { name: major },
      create: { id: major, name: major },
    });
    majorCount++;

    for (const sub of subs) {
      const subId = `${major}__${sub}`;
      await prisma.occupationSubItem.upsert({
        where: { id: subId },
        update: { name: sub },
        create: {
          id: subId,
          name: sub,
          occupationMajorItemId: majorItem.id,
        },
      });
      subCount++;
    }
  }
  console.log(`✓ ${majorCount} major occupations, ${subCount} sub occupations seeded`);

  // ============ Qualification Masters (資格マスタ) ============
  const qualifications: { name: string; category: string }[] = [
    // 建築士
    { name: "1級建築士", category: "建築士" },
    { name: "2級建築士", category: "建築士" },
    { name: "木造建築士", category: "建築士" },
    // 建築施工管理技士
    { name: "1級建築施工管理技士", category: "施工管理技士" },
    { name: "2級建築施工管理技士", category: "施工管理技士" },
    // 土木施工管理技士
    { name: "1級土木施工管理技士", category: "施工管理技士" },
    { name: "2級土木施工管理技士", category: "施工管理技士" },
    // 電気工事施工管理技士
    { name: "1級電気工事施工管理技士", category: "施工管理技士" },
    { name: "2級電気工事施工管理技士", category: "施工管理技士" },
    // 管工事施工管理技士
    { name: "1級管工事施工管理技士", category: "施工管理技士" },
    { name: "2級管工事施工管理技士", category: "施工管理技士" },
    // 建設機械施工技士
    { name: "1級建設機械施工技士", category: "施工管理技士" },
    { name: "2級建設機械施工技士", category: "施工管理技士" },
    // 造園施工管理技士
    { name: "1級造園施工管理技士", category: "施工管理技士" },
    { name: "2級造園施工管理技士", category: "施工管理技士" },
    // 電気通信工事施工管理技士
    { name: "1級電気通信工事施工管理技士", category: "施工管理技士" },
    { name: "2級電気通信工事施工管理技士", category: "施工管理技士" },
    // その他施工系
    { name: "解体工事施工技士", category: "施工管理技士" },
    // 技能士
    { name: "1級技能士 建築大工", category: "技能士" },
    { name: "2級技能士 建築大工", category: "技能士" },
    { name: "1級技能士 左官", category: "技能士" },
    { name: "2級技能士 左官", category: "技能士" },
    { name: "1級技能士 とび", category: "技能士" },
    { name: "2級技能士 とび", category: "技能士" },
    { name: "1級技能士 配管", category: "技能士" },
    { name: "2級技能士 配管", category: "技能士" },
    { name: "1級技能士 塗装", category: "技能士" },
    { name: "2級技能士 塗装", category: "技能士" },
    { name: "1級技能士 防水施工", category: "技能士" },
    { name: "2級技能士 防水施工", category: "技能士" },
    { name: "特級技能士 建設機械整備", category: "技能士" },
    { name: "1級技能士 建設機械整備", category: "技能士" },
    // 電気系
    { name: "第一種電気工事士", category: "電気" },
    { name: "第二種電気工事士", category: "電気" },
    { name: "1級電気工事施工管理技士補", category: "電気" },
    // 下水道
    { name: "下水道技術者(2種)", category: "下水道" },
    { name: "下水道技術者(3種)", category: "下水道" },
    // その他
    { name: "測量士", category: "その他" },
    { name: "測量士補", category: "その他" },
    { name: "宅地建物取引士", category: "その他" },
    { name: "消防設備士", category: "その他" },
    { name: "玉掛け技能講習修了", category: "その他" },
    { name: "足場の組立て等作業主任者", category: "その他" },
    { name: "酸素欠乏危険作業主任者", category: "その他" },
    { name: "有機溶剤作業主任者", category: "その他" },
  ];

  let qualCount = 0;
  for (let i = 0; i < qualifications.length; i++) {
    const q = qualifications[i];
    await prisma.qualificationMaster.upsert({
      where: { name: q.name },
      update: { category: q.category, sortOrder: i },
      create: { name: q.name, category: q.category, sortOrder: i },
    });
    qualCount++;
  }
  console.log(`✓ ${qualCount} qualifications seeded`);

  console.log("Seeding completed.");

  // Development: seed test data (users, companies, sample data)
  if (process.env.NODE_ENV !== "production") {
    const { seedTestData } = await import("./seed-test-data");
    await seedTestData(prisma);
  }
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
