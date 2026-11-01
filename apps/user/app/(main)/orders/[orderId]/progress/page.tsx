import { notFound } from "next/navigation";
import { getProgressContext } from "@/lib/actions/progress-billing";
import { ProgressReviewClient } from "./progress-review-client";

export default async function ProgressPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const ctx = await getProgressContext(orderId);
  if (!ctx) notFound();

  return <ProgressReviewClient ctx={ctx} />;
}
