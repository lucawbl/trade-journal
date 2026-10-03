import { JournalFilters } from "@/components/journal-filters";
import { readFilters } from "@luxalgo/journal-core";
import { JournalShell, Panel, SummaryMetrics } from "@/components/journal-view";
import { HistoryAnalysis } from "@/components/history-analysis";
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
    <JournalShell title="Historique & analyses" active="trades">
      <Panel title="Filtrer l’historique">
        <JournalFilters action="/trades" accounts={view.accounts} filters={filters} />
        <p className="mt-3 text-xs text-muted-foreground">
          Dates de clôture, ou d’ouverture pour les positions ouvertes · Fuseau : {view.timeZone}
        </p>
      </Panel>
      <div className="flex justify-end">
        <a
          href={`/api/export?${exportQuery}`}
          className="rounded-md border px-4 py-2 text-sm hover:bg-secondary"
        >
          Exporter cette sélection en CSV
        </a>
      </div>
      <SummaryMetrics view={view} />
      <HistoryAnalysis view={view} />
      <Panel title={`${view.rows.length} trade${view.rows.length === 1 ? "" : "s"}`}>
        <HistoryTrades view={view} />
        <p className="mt-4 text-xs text-muted-foreground">
          Déplie un trade pour voir ses détails et accéder aux exécutions. Le P&L des sorties
          partielles n’entre dans les statistiques clôturées qu’à la clôture complète.
        </p>
      </Panel>
    </JournalShell>
  );
}
