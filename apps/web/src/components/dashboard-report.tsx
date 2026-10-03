import {
  bySymbol,
  byDirection,
  byWeekday,
  readFilters,
  type BucketStats,
} from "@luxalgo/journal-core";
import { JournalFilters } from "@/components/journal-filters";
import { EquityChart, Panel, PnlValue, number } from "@/components/journal-view";
import {
  JournalVisualBars,
  JournalVisualColumns,
  JournalVisualDonut,
  JournalVisualMetric,
} from "@/components/journal-visual-charts";
import { readJournalView } from "@/server/journal-view";

const weekdays: Record<string, string> = {
  Sun: "Dim",
  Mon: "Lun",
  Tue: "Mar",
  Wed: "Mer",
  Thu: "Jeu",
  Fri: "Ven",
  Sat: "Sam",
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
  return (
    <JournalVisualBars
      items={groups.map((group) => ({
        label: labels[group.key] ?? group.key.replace("USDT", ""),
        value: monetary ? group.netPnl : group.trades,
        note: `${group.trades} clôtures · ${group.winRate === null ? "—" : `${number(group.winRate * 100, 0)} %`} réussite`,
      }))}
      currency={monetary ? currency : "clôtures"}
      signed={monetary}
    />
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
  const filtered = Object.entries(filters).some(
    ([key, value]) => key !== "status" && Boolean(value),
  );
  return (
    <>
      <details className="rounded-xl border bg-card p-4" open={filtered || !monetary}>
        <summary className="cursor-pointer text-sm font-medium">
          Période et comptes{filtered ? " · sélection active" : ""}
        </summary>
        <div className="mt-4">
          <JournalFilters
            action="/"
            accounts={view.accounts}
            filters={filters}
            closedOnly
            extraFields={{ view: "bilan" }}
          />
        </div>
      </details>
      {!monetary && (
        <p role="status" className="text-xs text-muted-foreground">
          Choisis un compte pour afficher les montants dans sa devise.
        </p>
      )}
      <section aria-label="Bilan clôturé" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <JournalVisualMetric
          label="P&L clôturé"
          value={monetary ? <PnlValue value={metrics.netPnl} currency={currency} /> : "—"}
        />
        <JournalVisualMetric label="Clôtures" value={metrics.closedTrades} />
        <JournalVisualMetric
          label="Profit factor"
          value={
            monetary ? (metrics.profitFactorIsInfinite ? "∞" : number(metrics.profitFactor)) : "—"
          }
        />
        <JournalVisualMetric
          label="Drawdown max."
          value={monetary ? `${number(metrics.maxDrawdown)} ${currency}` : "—"}
        />
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="P&L cumulé">
          {monetary ? (
            <EquityChart points={view.overview.equity} currency={currency} detailed />
          ) : (
            <p className="py-8 text-xs text-muted-foreground">Une devise à la fois.</p>
          )}
        </Panel>
        <Panel title="Réussite">
          <JournalVisualDonut
            segments={[
              { label: "Gagnants", value: metrics.wins, color: "var(--profit)" },
              { label: "Perdants", value: metrics.losses, color: "var(--loss)" },
              { label: "Équilibre", value: metrics.breakevens, color: "var(--baseline)" },
            ]}
            value={metrics.winRate === null ? "—" : `${number(metrics.winRate * 100, 0)} %`}
            label="réussite"
          />
        </Panel>
      </div>
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <Panel title="Par crypto">
          <Breakdown groups={bySymbol(closed)} {...breakdown} />
        </Panel>
        <Panel title="Par sens">
          <Breakdown
            groups={byDirection(closed)}
            {...breakdown}
            labels={{ long: "Long", short: "Short" }}
          />
        </Panel>
        <Panel title="Par jour de clôture">
          <JournalVisualColumns
            items={view.overview.days
              .slice(-31)
              .map((day) => ({
                label: day.date,
                value: monetary ? day.netPnl : day.trades,
                trades: day.trades,
                href: `/trades?${new URLSearchParams({ ...filters, from: day.date, to: day.date })}`,
              }))}
            currency={monetary ? currency : ""}
            monetary={monetary}
          />
        </Panel>
        <Panel title="Par jour d’ouverture">
          <Breakdown groups={byWeekday(closed, view.timeZone)} {...breakdown} labels={weekdays} />
        </Panel>
      </div>
      <details className="rounded-xl border bg-card p-4 text-xs">
        <summary className="cursor-pointer font-medium">Chiffres détaillés</summary>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">P&L moyen / clôture</dt>
            <dd className="mt-1">
              {monetary && metrics.expectancy !== null ? (
                <PnlValue value={metrics.expectancy} currency={currency} />
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Frais</dt>
            <dd className="tnum mt-1">{monetary ? `${number(metrics.fees)} ${currency}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fuseau</dt>
            <dd className="mt-1 break-words">{view.timeZone}</dd>
          </div>
        </dl>
        <p className="mt-4 text-muted-foreground">
          Positions entièrement clôturées, après frais. Profit factor : gains / pertes. Drawdown :
          recul maximal du P&L cumulé.
        </p>
      </details>
      <div className="flex flex-wrap gap-3 text-xs">
        <a
          href={`/trades?${new URLSearchParams(filters)}`}
          className="rounded-md border px-3 py-2 hover:bg-secondary"
        >
          Trades →
        </a>
        <a
          href={`/api/export?${new URLSearchParams({ ...filters, format: "csv" })}`}
          className="rounded-md border px-3 py-2 hover:bg-secondary"
        >
          Exporter CSV
        </a>
      </div>
    </>
  );
}
