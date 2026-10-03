import { readFilters } from "@luxalgo/journal-core";
import { Download } from "lucide-react";
import { JournalShell, Panel } from "@/components/journal-view";
import { HistoryAnalysis, HistorySummary } from "@/components/history-analysis";
import { HistoryTrades } from "@/components/history-trades";
import { readJournalView, requireJournalSession } from "@/server/journal-view";

export const dynamic = "force-dynamic";
type Params = Record<string, string | string[] | undefined>;

export default async function TradesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireJournalSession();
  const params = await searchParams;
  const value = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const filters = readFilters({ get: value });
  const view = readJournalView(filters);
  const exportQuery = new URLSearchParams({ ...filters, format: "csv" }).toString();
  return (
    <JournalShell title="Historique" active="trades">
      <div className="flex justify-end">
        <a
          href={`/api/export?${exportQuery}`}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-secondary"
          aria-label="Exporter les trades de cette sélection en CSV"
        >
          <Download className="h-4 w-4" aria-hidden="true" /> CSV
        </a>
      </div>
      <HistorySummary view={view} />
      <HistoryAnalysis view={view} />
      <Panel title={`${view.rows.length} trade${view.rows.length === 1 ? "" : "s"}`}>
        <HistoryTrades view={view} />
      </Panel>
    </JournalShell>
  );
}
