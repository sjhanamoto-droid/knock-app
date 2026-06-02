import { notFound } from "next/navigation";
import { getNotificationDetail } from "@/lib/actions/notifications";
import { NotificationDetailClient } from "./notification-detail-client";

export default async function NotificationDetailPage({
  params,
}: {
  params: Promise<{ notificationId: string }>;
}) {
  const { notificationId } = await params;
  // 取得と同時に未読なら既読化される
  const notification = await getNotificationDetail(notificationId);
  if (!notification) notFound();

  return <NotificationDetailClient notification={notification} />;
}
