import { initializeApp, getApps, cert, type App } from "firebase-admin/app";

let adminApp: App | undefined;

export function getAdminApp(): App | null {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) return null;

  try {
    const serviceAccount = JSON.parse(key);
    adminApp = initializeApp({ credential: cert(serviceAccount) });
    return adminApp;
  } catch {
    return null;
  }
}
