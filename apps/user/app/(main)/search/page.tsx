import { getServerMode } from "@/lib/mode-server";
import { searchContractors } from "@/lib/actions/contractors";
import { getOccupationMasters } from "@/lib/actions/occupations";
import {
  searchJobsWithLocation,
  searchContractorsWithLocation,
} from "@/lib/actions/map-search";
import { SearchClient } from "./search-client";

export default async function SearchPage() {
  const modeData = await getServerMode();

  const [contractors, majors, jobPins, contractorPins] = await Promise.all([
    searchContractors(),
    getOccupationMasters(),
    modeData.isContractor ? searchJobsWithLocation() : ([] as Awaited<ReturnType<typeof searchJobsWithLocation>>),
    modeData.isContractor ? ([] as Awaited<ReturnType<typeof searchContractorsWithLocation>>) : searchContractorsWithLocation(),
  ]);

  return (
    <SearchClient
      initialContractors={contractors}
      initialMajors={majors}
      initialJobPins={jobPins}
      initialContractorPins={contractorPins}
    />
  );
}
