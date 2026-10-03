import { AiChat } from "@/components/ai-chat";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireJournalSession } from "@/server/journal-view";

export const dynamic = "force-dynamic";

export default async function AiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireJournalSession();
  const params = await searchParams;
  const prompt = typeof params.prompt === "string" ? params.prompt.slice(0, 4000) : "";
  return (
    <DashboardShell title="IA" active="/ai">
      <AiChat initialMessage={prompt} />
    </DashboardShell>
  );
}
