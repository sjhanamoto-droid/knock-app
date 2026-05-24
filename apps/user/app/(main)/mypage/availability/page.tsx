import { getAvailabilitySlots, getAvailabilitySettings } from "@/lib/actions/availability";
import { AvailabilityClient } from "./availability-client";

export default async function AvailabilityPage() {
  const today = new Date();
  const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const [slotsData, settings] = await Promise.all([
    getAvailabilitySlots(yearMonth),
    getAvailabilitySettings(),
  ]);

  const initialSlots = slotsData.map((s) => ({
    date: s.date instanceof Date ? s.date.toISOString() : String(s.date),
    status: s.status,
  }));

  return (
    <AvailabilityClient
      initialSlots={initialSlots}
      initialIsPublic={settings.isPublic}
    />
  );
}
