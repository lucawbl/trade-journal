import { AiChat } from "@/components/ai-chat";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireJournalSession } from "@/server/journal-view";

export const dynamic = "force-dynamic";

export default async function AiPage() {
  await requireJournalSession();
  return (
    <DashboardShell title="IA" active="/ai">
      <AiChat />
    </DashboardShell>
  );
}
