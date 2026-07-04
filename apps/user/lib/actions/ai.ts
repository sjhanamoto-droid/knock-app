"use server";

import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/session";

const client = new Anthropic(); // ANTHROPIC_API_KEY を自動参照

/**
 * 施工報告コメントの下書きを AI で生成する。
 * DB は触らず、画面に既に表示済みの文字列のみを受け取るため所有権(IDOR)の懸念はない。
 * ログイン必須。生成結果はユーザーが編集して送信する（AIは下書き、確定は人）。
 */
export async function draftCompletionReport(input: {
  siteName: string;
  counterpartyName?: string;
  completionDate: string;
  photoCount: number;
  hasAdditionalWork?: boolean;
  additionalWorkMemo?: string;
  roughNotes?: string;
}): Promise<{ text: string } | { error: string }> {
  await requireSession();

  // 入力長ガード（乱用・過大トークン防止）
  const notes = (input.roughNotes ?? "").slice(0, 2000);
  const additionalMemo = (input.additionalWorkMemo ?? "").slice(0, 1000);

  const system =
    "あなたは日本の建設業向けSaaSのアシスタント。受注者が発注者に提出する『施工報告コメント』を、" +
    "丁寧で簡潔な日本語のビジネス文（3〜5文程度）で作成する。誇張や虚偽は書かない。" +
    "与えられた事実のみを使い、不明な点は書かない。宛名や署名は不要。本文のみ返す。";

  const userMsg =
    `現場名: ${input.siteName}\n` +
    (input.counterpartyName ? `取引先: ${input.counterpartyName}\n` : "") +
    `完了日: ${input.completionDate}\n` +
    `施工写真: ${input.photoCount}枚\n` +
    (input.hasAdditionalWork
      ? `追加工事: あり（${additionalMemo || "内容未記入"}）\n`
      : "") +
    (notes ? `\n受注者の下書きメモ:\n${notes}\n` : "") +
    `\n上記をもとに施工報告コメントの本文を作成してください。`;

  try {
    const res = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: userMsg }],
    });

    if (res.stop_reason === "refusal") {
      return { error: "内容を生成できませんでした。手入力でお願いします。" };
    }

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return text ? { text } : { error: "生成結果が空でした。もう一度お試しください。" };
  } catch (e) {
    console.error("[draftCompletionReport]", e);
    return { error: "AIの呼び出しに失敗しました。しばらくして再試行してください。" };
  }
}
