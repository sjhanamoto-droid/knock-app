/**
 * 職種マスタデータ投入スクリプト
 *
 * 使い方:
 *   DATABASE_URL="postgresql://..." node scripts/seed-occupations.mjs
 */
import pg from "pg";

const occupations = [
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

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("ERROR: DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString });

  try {
    const client = await pool.connect();
    console.log("Connected to database");

    let majorCount = 0;
    let subCount = 0;
    const now = new Date().toISOString();

    for (const { major, subs } of occupations) {
      await client.query(
        `INSERT INTO occupation_major_items (id, name, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (id) DO UPDATE SET name = $2, "updatedAt" = $3`,
        [major, major, now]
      );
      majorCount++;

      for (const sub of subs) {
        const subId = `${major}__${sub}`;
        await client.query(
          `INSERT INTO occupation_sub_items (id, "occupationMajorItemId", name, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $4)
           ON CONFLICT (id) DO UPDATE SET name = $3, "updatedAt" = $4`,
          [subId, major, sub, now]
        );
        subCount++;
      }
    }

    console.log(`Done: ${majorCount} major occupations, ${subCount} sub occupations seeded`);
    client.release();
  } catch (err) {
    console.error("Error seeding occupations:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
