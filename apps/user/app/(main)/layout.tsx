import { getServerMode } from "@/lib/mode-server";
import { getHomeBadgeCounts } from "@/lib/actions/home";
import { ModeProvider } from "@/lib/hooks/use-mode";
import { PushNotificationProvider } from "@/components/push-notification-provider";
import { BottomNav } from "@/components/bottom-nav";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [modeData, badgeCounts] = await Promise.all([
    getServerMode(),
    getHomeBadgeCounts(),
  ]);

  return (
    <ModeProvider initialMode={modeData.mode} initialCompanyType={modeData.companyType}>
      <PushNotificationProvider />
      <div className="mx-auto flex min-h-[100dvh] max-w-[430px] flex-col bg-knock-bg">
        <main className="flex-1 pb-20">{children}</main>
        <BottomNav
          isOrderer={modeData.isOrderer}
          accentColor={modeData.accentColor}
          initialChatBadge={badgeCounts.chats > 0}
        />
      </div>
    </ModeProvider>
  );
}
