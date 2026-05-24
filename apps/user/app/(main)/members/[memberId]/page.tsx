import { getMember } from "@/lib/actions/members";
import { MemberDetailClient } from "./member-detail-client";

export default async function MemberDetailPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const member = await getMember(memberId);
  return <MemberDetailClient initialMember={member} memberId={memberId} />;
}
