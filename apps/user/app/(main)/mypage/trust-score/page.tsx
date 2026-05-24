import { getTrustScore } from "@/lib/actions/trust-score-page";
import { getReceivedEvaluations } from "@/lib/actions/evaluations";
import { TrustScoreClient } from "./trust-score-client";

export default async function TrustScorePage() {
  const [score, evals] = await Promise.all([
    getTrustScore(),
    getReceivedEvaluations(1, 5),
  ]);

  return <TrustScoreClient initialScore={score} initialEvals={evals} />;
}
