import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:noreply@knock-app.jp";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function sendPushToUsers(params: {
  userIds: string[];
  title: string;
  body: string;
  url?: string;
}) {
  const { userIds, title, body, url } = params;
  if (userIds.length === 0) return;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const tokens = await prisma.deviceToken.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, token: true },
  });

  if (tokens.length === 0) return;

  const payload = JSON.stringify({
    title,
    body,
    url: url ?? "/",
    icon: "/icons/icon-192x192.png",
  });

  const invalidTokenIds: string[] = [];

  await Promise.allSettled(
    tokens.map(async (t) => {
      try {
        const subscription = JSON.parse(t.token);
        await webpush.sendNotification(subscription, payload);
      } catch (err: unknown) {
        const statusCode =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : 0;
        // 410 Gone or 404 = subscription expired/invalid
        if (statusCode === 410 || statusCode === 404) {
          invalidTokenIds.push(t.id);
        }
      }
    })
  );

  if (invalidTokenIds.length > 0) {
    await prisma.deviceToken.deleteMany({
      where: { id: { in: invalidTokenIds } },
    });
  }
}
