import { getApplicationsForJob } from "@/lib/actions/job-postings";
import { ApplicationsClient } from "./applications-client";

export default async function ApplicationsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const applications = await getApplicationsForJob(jobId);
  return <ApplicationsClient initialApplications={applications} jobId={jobId} />;
}
