import { getProfile } from "@/lib/actions/profile";
import { getAreas } from "@/lib/actions/contractors";
import { getOccupationMasters, getCompanyOccupations } from "@/lib/actions/occupations";
import { CompanyEditClient } from "./company-client";

export default async function CompanyEditPage() {
  const [profile, masters, areas, companyOccupations] = await Promise.all([
    getProfile(),
    getOccupationMasters(),
    getAreas(),
    getCompanyOccupations(),
  ]);

  const initialSelections = companyOccupations.map((o) => ({
    occupationSubItemId: o.occupationSubItemId,
    note: o.note ?? undefined,
  }));

  return (
    <CompanyEditClient
      initialProfile={profile}
      initialMasters={masters}
      initialSelections={initialSelections}
      initialAreaMasters={areas}
    />
  );
}
