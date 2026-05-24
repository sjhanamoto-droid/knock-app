import { getInvitation } from "@/lib/actions/invitations";
import { InvitationDetailClient } from "./invitation-detail-client";

export default async function InvitationDetailPage({ params }: { params: Promise<{ invitedId: string }> }) {
  const { invitedId } = await params;
  const invitation = await getInvitation(invitedId);
  return <InvitationDetailClient initialInvitation={invitation} invitedId={invitedId} />;
}
