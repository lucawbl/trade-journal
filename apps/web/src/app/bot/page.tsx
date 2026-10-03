import { BotStudio } from "@/components/bot-studio";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireJournalSession } from "@/server/journal-view";

export const dynamic = "force-dynamic";

export default async function BotPage() {
  await requireJournalSession();
  return (
    <DashboardShell
      title="Bot"
      active="/bot"
      description="Discute de tes réglages et prépare tes changements."
    >
      <BotStudio />
    </DashboardShell>
  );
}
