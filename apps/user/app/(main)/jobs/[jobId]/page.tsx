import { getJobDetail } from "@/lib/actions/job-search";
import { JobDetailClient } from "./job-detail-client";

export default async function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJobDetail(jobId);
  return <JobDetailClient initialJob={job} jobId={jobId} />;
}
