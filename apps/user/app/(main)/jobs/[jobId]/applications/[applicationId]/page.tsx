import { getApplicationDetail } from "@/lib/actions/job-postings";
import { ApplicationDetailClient } from "./application-detail-client";

export default async function ApplicationDetailPage({ params }: { params: Promise<{ jobId: string; applicationId: string }> }) {
  const { applicationId } = await params;
  const app = await getApplicationDetail(applicationId);
  return <ApplicationDetailClient initialApp={app} applicationId={applicationId} />;
}
