import { getProfile } from "@/lib/actions/profile";
import { getTrustScore } from "@/lib/actions/trust-score-page";
import { MyPageClient } from "./mypage-client";

export default async function MyPage() {
  const [profile, trustScore] = await Promise.all([
    getProfile(),
    getTrustScore(),
  ]);

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <p className="text-[14px] text-red-600 text-center">プロフィールの取得に失敗しました</p>
        <a
          href="/mypage"
          className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-700"
        >
          再読み込み
        </a>
      </div>
    );
  }

  const trustScoreValue = Number(trustScore.overallScore);

  return (
    <MyPageClient
      profile={profile}
      trustScoreValue={trustScoreValue}
    />
  );
}
