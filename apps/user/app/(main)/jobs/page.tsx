import { searchJobs, getOccupationOptions } from "@/lib/actions/job-search";
import { JobsClient } from "./jobs-client";

export default async function JobsPage() {
  const [result, occupations] = await Promise.all([
    searchJobs({}),
    getOccupationOptions(),
  ]);

  return (
    <JobsClient
      initialResult={result}
      initialOccupations={occupations}
    />
  );
}
