import { getAdminApp } from "./firebase-admin";
import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "@knock/db";

export async function sendPushToUsers(params: {
  userIds: string[];
  title: string;
  body: string;
  url?: string;
}) {
  const { userIds, title, body, url } = params;
  if (userIds.length === 0) return;

  const app = getAdminApp();
  if (!app) return;

  const tokens = await prisma.deviceToken.findMany({
    where: { userId: { in: userIds } },
    select: { token: true },
  });

  if (tokens.length === 0) return;

  const messaging = getMessaging(app);
  const tokenStrings = tokens.map((t) => t.token);

  const response = await messaging.sendEachForMulticast({
    tokens: tokenStrings,
    notification: { title, body },
    webpush: {
      fcmOptions: { link: url ?? "/" },
      notification: {
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
      },
    },
    data: url ? { url } : undefined,
  });

  // Remove invalid tokens
  const invalidTokens: string[] = [];
  response.responses.forEach((res, i) => {
    if (
      !res.success &&
      res.error &&
      (res.error.code === "messaging/registration-token-not-registered" ||
        res.error.code === "messaging/invalid-registration-token")
    ) {
      invalidTokens.push(tokenStrings[i]);
    }
  });

  if (invalidTokens.length > 0) {
    await prisma.deviceToken.deleteMany({
      where: { token: { in: invalidTokens } },
    });
  }
}
