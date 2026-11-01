import { notFound } from "next/navigation";
import { getProgressContext } from "@/lib/actions/progress-billing";
import { ProgressReportClient } from "./progress-report-client";

export default async function ProgressReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ resubmit?: string }>;
}) {
  const { orderId } = await params;
  const { resubmit } = await searchParams;
  const ctx = await getProgressContext(orderId);
  if (!ctx) notFound();

  return <ProgressReportClient ctx={ctx} resubmit={resubmit === "1"} />;
}
