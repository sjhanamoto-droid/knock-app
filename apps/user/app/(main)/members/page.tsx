import { getMembers } from "@/lib/actions/members";
import { MembersClient } from "./members-client";

export default async function MembersPage() {
  const members = await getMembers();
  return <MembersClient initialMembers={members} />;
}
