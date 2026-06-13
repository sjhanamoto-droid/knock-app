import { notFound } from "next/navigation";
import { getWorkCompletion } from "@/lib/actions/orders";
import { WorkCompletionClient } from "./work-completion-client";

export default async function WorkCompletionPage({ params }: { params: Promise<{ floorId: string }> }) {
  const { floorId } = await params;
  const data = await getWorkCompletion(floorId);
  if (!data) notFound();

  return <WorkCompletionClient data={data} floorId={floorId} />;
}
