import { getActiveTransactions, getMonthlySummary, getHomeBadgeCounts } from "@/lib/actions/home";
import { getVerificationStatus } from "@/lib/actions/verification";
import { HomeClient } from "./home-client";

export default async function HomePage() {
  const [transactions, summary, badgeCounts, verification] = await Promise.all([
    getActiveTransactions(),
    getMonthlySummary(),
    getHomeBadgeCounts(),
    getVerificationStatus().catch(() => ({ isKycComplete: true, registrationStep: null, companyName: "" })),
  ]);

  const kycStep = !verification.isKycComplete ? verification.registrationStep : null;

  return (
    <HomeClient
      transactions={transactions}
      summary={summary}
      badgeCounts={badgeCounts}
      kycStep={kycStep}
    />
  );
}
