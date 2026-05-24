import { checkContractorRequirements } from "@/lib/actions/contractor-requirements";
import { RequirementsClient } from "./requirements-client";

export default async function RequirementsPage() {
  const check = await checkContractorRequirements();
  return <RequirementsClient initialCheck={check} />;
}
