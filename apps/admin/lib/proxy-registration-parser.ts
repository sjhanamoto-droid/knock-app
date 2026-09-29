// 代理登録メール（発注者/受注者）の「ご返信用フォーマット」を読み取って登録項目に変換する。
// 返信は手書きで崩れることがあるため、読み取れなかった項目は空欄＋warningsで知らせ、確認画面で直してもらう前提。

export const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

export type ProxyRegistrationFields = {
  companyForm: "CORPORATION" | "INDIVIDUAL" | "";
  businessName: string;
  nameKana: string;
  postalCode: string;
  prefecture: string;
  city: string;
  streetAddress: string;
  building: string;
  companyTel: string;
  invoiceDigits: string; // Tを除く13桁
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  personTel: string;
  bankName: string;
  bankBranchName: string;
  bankAccountType: "ORDINARY" | "CURRENT" | "";
  bankAccountNumber: string;
  bankAccountName: string;
  occupationsText: string;
};

export type ParseResult = {
  fields: ProxyRegistrationFields;
  /** true=■で同意 / false=□のまま / null=同意行が見つからない */
  agreed: boolean | null;
  warnings: string[];
};

export function emptyFields(): ProxyRegistrationFields {
  return {
    companyForm: "", businessName: "", nameKana: "", postalCode: "", prefecture: "",
    city: "", streetAddress: "", building: "", companyTel: "", invoiceDigits: "",
    lastName: "", firstName: "", lastNameKana: "", firstNameKana: "",
    birthYear: "", birthMonth: "", birthDay: "", personTel: "",
    bankName: "", bankBranchName: "", bankAccountType: "", bankAccountNumber: "",
    bankAccountName: "", occupationsText: "",
  };
}

/** 全角英数・記号を半角に（電話番号・口座番号・郵便番号などの正規化用） */
export function toHalfWidth(s: string): string {
  return s
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－―‐−]/g, "-")
    .replace(/(\d)ー(?=\d)/g, "$1-");
}

const CHECK_MARKS = /[■☑✅✓✔●◉◎○◯]/;

/** 「法人 ／ 個人事業主」のような選択肢から、残された（または印の付いた）方を選ぶ */
function pickChoice<T extends string>(
  value: string,
  options: { word: string; value: T }[]
): T | "" {
  const present = options.filter((o) => value.includes(o.word));
  if (present.length === 1) return present[0]!.value;
  if (present.length > 1) {
    const marked = present.filter((o) => {
      const i = value.indexOf(o.word);
      const around = value.slice(Math.max(0, i - 2), i + o.word.length + 2);
      return CHECK_MARKS.test(around);
    });
    if (marked.length === 1) return marked[0]!.value;
  }
  return "";
}

function splitName(value: string): [string, string] {
  const [first = "", ...rest] = value.trim().split(/[\s　]+/).filter(Boolean);
  return [first, rest.join("")];
}

function formatPostal(value: string): string {
  const d = toHalfWidth(value).replace(/\D/g, "");
  return d.length === 7 ? `${d.slice(0, 3)}-${d.slice(3)}` : toHalfWidth(value).trim();
}

/** 「東京都渋谷区神宮前1-2-3」→ 都道府県 / 市区町村 / 番地（最初の数字の手前で区切る） */
export function splitAddress(value: string): { prefecture: string; city: string; streetAddress: string } {
  const v = toHalfWidth(value).replace(/[\s　]+/g, "");
  const prefecture = PREFECTURES.find((p) => v.startsWith(p)) ?? "";
  const rest = v.slice(prefecture.length);
  const m = rest.match(/\d/);
  if (!m || m.index === undefined) return { prefecture, city: rest, streetAddress: "" };
  return { prefecture, city: rest.slice(0, m.index), streetAddress: rest.slice(m.index) };
}

type Section = "none" | "agree" | "company" | "person" | "bank" | "occupation";

function detectSection(line: string): Section | null {
  const m = line.match(/【([^】]+)】/);
  if (!m) return null;
  const t = m[1];
  if (t.includes("同意")) return "agree";
  if (t.includes("会社")) return "company";
  if (t.includes("担当")) return "person";
  if (t.includes("振込") || t.includes("受注")) return "bank";
  if (t.includes("職種")) return "occupation";
  return "none";
}

export function parseProxyRegistrationText(text: string): ParseResult {
  const f = emptyFields();
  const warnings: string[] = [];
  let agreed: boolean | null = null;
  let section: Section = "none";
  const occupationLines: string[] = [];

  const lines = text.split(/\r?\n/).map((l) => l.replace(/^[>＞\s　]+/, "").trimEnd());

  for (const line of lines) {
    if (!line) continue;
    if (/^[━─=＝-]{5,}/.test(line)) {
      section = "none";
      continue;
    }

    const sec = detectSection(line);
    if (sec) {
      section = sec;
      continue;
    }

    if (section === "agree" && line.includes("同意")) {
      if (CHECK_MARKS.test(line)) agreed = true;
      else if (line.includes("□") && agreed === null) agreed = false;
      continue;
    }

    const sep = line.search(/[：:]/);
    if (section === "occupation") {
      const v = sep >= 0 ? line.slice(sep + 1) : line;
      if (!/^例/.test(line) && v.trim()) occupationLines.push(v.trim());
      continue;
    }
    if (sep < 0) continue;

    const key = line.slice(0, sep).replace(/[※\s　]/g, "");
    const value = line.slice(sep + 1).trim();
    // 返信に引用された未記入のテンプレート（「T」「　年　月　日」等）で上書きしない
    if (!/[^\sT年月日／/]/.test(value)) continue;

    if (key.startsWith("事業形態")) {
      const picked = pickChoice(value, [
        { word: "個人", value: "INDIVIDUAL" },
        { word: "法人", value: "CORPORATION" },
      ]);
      if (picked) f.companyForm = picked;
    } else if (key.startsWith("事業者名")) {
      f.businessName = value;
    } else if (key.startsWith("郵便番号")) {
      f.postalCode = formatPostal(value);
    } else if (key.startsWith("住所")) {
      Object.assign(f, splitAddress(value));
      if (!f.prefecture) warnings.push("住所から都道府県を判別できませんでした");
      if (!f.streetAddress) warnings.push("住所を市区町村と番地に分けられませんでした");
    } else if (key.startsWith("建物名")) {
      f.building = value;
    } else if (key.startsWith("インボイス")) {
      const digits = toHalfWidth(value).replace(/\D/g, "");
      if (digits) {
        f.invoiceDigits = digits;
        if (digits.length !== 13) warnings.push("インボイス登録番号が13桁ではありません");
      }
    } else if (key.startsWith("氏名")) {
      [f.lastName, f.firstName] = splitName(value);
      if (!f.firstName) warnings.push("氏名を姓と名に分けられませんでした（姓に全体を入れています）");
    } else if (key.startsWith("生年月日")) {
      const [y, m, d] = toHalfWidth(value).match(/\d+/g) ?? [];
      if (y?.length === 4 && m && d) {
        [f.birthYear, f.birthMonth, f.birthDay] = [y, String(Number(m)), String(Number(d))];
      } else {
        warnings.push("生年月日を読み取れませんでした（西暦で記入されているか確認してください）");
      }
    } else if (key.startsWith("フリガナ")) {
      if (section === "person") {
        [f.lastNameKana, f.firstNameKana] = splitName(value);
        if (!f.firstNameKana) warnings.push("担当者フリガナをセイとメイに分けられませんでした");
      } else {
        f.nameKana = value;
      }
    } else if (key.startsWith("電話番号")) {
      const tel = toHalfWidth(value).replace(/[^\d-]/g, "");
      if (key.includes("会社")) f.companyTel = tel;
      else if (key.includes("携帯") || section === "person") f.personTel = tel;
      else f.companyTel = tel;
    } else if (key.startsWith("銀行名")) {
      f.bankName = value;
    } else if (key.startsWith("支店名")) {
      f.bankBranchName = value;
    } else if (key.startsWith("口座種別")) {
      const picked = pickChoice(value, [
        { word: "普通", value: "ORDINARY" },
        { word: "当座", value: "CURRENT" },
      ]);
      if (picked) f.bankAccountType = picked;
    } else if (key.startsWith("口座番号")) {
      f.bankAccountNumber = toHalfWidth(value).replace(/\D/g, "");
    } else if (key.startsWith("口座名義")) {
      f.bankAccountName = value;
    }
  }

  f.occupationsText = occupationLines.join("、");
  if (!f.companyForm) warnings.push("事業形態（法人／個人事業主）を判別できませんでした");
  // 口座種別は未記入でも「普通 ／ 当座」が残るため、他の口座項目がある時だけ警告する
  if (f.bankAccountNumber && !f.bankAccountType) warnings.push("口座種別（普通／当座）を判別できませんでした");
  if (agreed === null) warnings.push("利用規約への同意の記載が見つかりませんでした");
  else if (agreed === false) warnings.push("利用規約への同意が「□」のままです（■になっていません）");

  return { fields: f, agreed, warnings };
}

/** 対応職種の自由記述を職種マスタ（小分類）に当てはめる */
export function matchOccupations(
  text: string,
  masters: { subItems: { id: string; name: string }[] }[]
): string[] {
  const tokens = text
    .split(/[、,，/／・\s　]+/)
    .map((t) => t.replace(/(工事|など|等)$/g, "").trim())
    .filter((t) => t.length >= 2);
  const ids = new Set<string>();
  for (const m of masters) {
    for (const s of m.subItems) {
      if (tokens.some((t) => s.name.includes(t) || t.includes(s.name))) ids.add(s.id);
    }
  }
  return [...ids];
}
