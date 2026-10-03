import {
  bySymbol,
  byDirection,
  byWeekday,
  readFilters,
  type BucketStats,
} from "@luxalgo/journal-core";
import { JournalFilters } from "@/components/journal-filters";
import {
  EquityChart,
  Metric,
  Panel,
  PnlValue,
  SummaryMetrics,
  number,
} from "@/components/journal-view";
import { readJournalView } from "@/server/journal-view";

const weekdays: Record<string, string> = {
  Sun: "Dimanche",
  Mon: "Lundi",
  Tue: "Mardi",
  Wed: "Mercredi",
  Thu: "Jeudi",
  Fri: "Vendredi",
  Sat: "Samedi",
};

function Breakdown({
  groups,
  currency,
  monetary,
  labels = {},
}: {
  groups: BucketStats[];
  currency: string;
  monetary: boolean;
  labels?: Record<string, string>;
}) {
  if (!groups.length)
    return (
      <p className="py-6 text-sm text-muted-foreground">
        Aucun trade clôturé pour cette sélection.
      </p>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-left text-sm">
        <thead>
          <tr>
            {["Groupe", "Clôturés", "Réussite", "P&L net"].map((label) => (
              <th
                key={label}
                scope="col"
                className="pb-3 pr-4 text-xs font-normal text-muted-foreground"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.key} className="border-t">
              <th scope="row" className="py-3 pr-4 font-normal">
                {labels[group.key] ?? group.key}
              </th>
              <td className="tnum pr-4">{group.trades}</td>
              <td className="tnum pr-4">
                {group.winRate === null ? "—" : `${number(group.winRate * 100, 1)} %`}
              </td>
              <td>{monetary ? <PnlValue value={group.netPnl} currency={currency} /> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardReport({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const filters = {
    ...readFilters({
      get: (key) => (typeof params[key] === "string" ? (params[key] as string) : null),
    }),
    status: "closed",
  };
  const view = readJournalView(filters);
  const { monetary, currency: scopeCurrency } = view.currencyScope;
  const currency = scopeCurrency ?? "";
  const closed = (monetary ? view.projectedTrades : view.trades).filter(
    (trade) => trade.status !== "open",
  );
  const metrics = view.overview.metrics;
  const breakdown = { currency, monetary };
  return (
    <>
      <Panel title="Période et comptes">
        <JournalFilters
          action="/"
          accounts={view.accounts}
          filters={filters}
          closedOnly
          extraFields={{ view: "bilan" }}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Résultats des trades entièrement clôturés, après frais · Fuseau : {view.timeZone}
        </p>
      </Panel>
      {!monetary && (
        <p role="status" className="rounded-lg border p-4 text-sm text-muted-foreground">
          Plusieurs devises sont présentes. Sélectionnez un compte pour afficher les montants et la
          courbe.
        </p>
      )}
      <SummaryMetrics view={view} />
      <Panel title="P&L cumulé de la période">
        {monetary ? (
          <EquityChart points={view.overview.equity} currency={currency} />
        ) : (
          <p className="text-sm text-muted-foreground">Courbe disponible pour une devise unique.</p>
        )}
      </Panel>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Profit factor"
          value={
            monetary ? (metrics.profitFactorIsInfinite ? "∞" : number(metrics.profitFactor)) : "—"
          }
          hint="Somme des gains / somme des pertes"
        />
        <Metric
          label="Drawdown maximal"
          value={monetary ? `${number(metrics.maxDrawdown)} ${currency}` : "—"}
          hint="Recul maximal du P&L cumulé sur la période"
        />
        <Metric
          label="Gain moyen par trade"
          value={
            monetary && metrics.expectancy !== null ? (
              <PnlValue value={metrics.expectancy} currency={currency} />
            ) : (
              "—"
            )
          }
          hint="P&L net / nombre de trades clôturés"
        />
        <Metric
          label="Frais"
          value={monetary ? `${number(metrics.fees)} ${currency}` : "—"}
          hint="Frais des trades clôturés de la sélection"
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Performance par symbole">
          <Breakdown groups={bySymbol(closed)} {...breakdown} />
        </Panel>
        <Panel title="Performance par sens">
          <Breakdown
            groups={byDirection(closed)}
            {...breakdown}
            labels={{ long: "Long", short: "Short" }}
          />
        </Panel>
      </div>
      <Panel title="Performance par jour d’ouverture">
        <Breakdown groups={byWeekday(closed, view.timeZone)} {...breakdown} labels={weekdays} />
      </Panel>
      <div className="flex flex-wrap gap-3">
        <a
          href={`/trades?${new URLSearchParams(filters)}`}
          className="rounded-md border px-4 py-2 text-sm hover:bg-secondary"
        >
          Voir les trades de ce rapport
        </a>
        <a
          href={`/api/export?${new URLSearchParams({ ...filters, format: "csv" })}`}
          className="rounded-md border px-4 py-2 text-sm hover:bg-secondary"
        >
          Exporter les trades en CSV
        </a>
      </div>
    </>
  );
}
