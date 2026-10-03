import { dailyStats } from "@luxalgo/journal-core";
import type { JournalView } from "@/server/journal-view";
import { EquityChart, Panel, PnlValue, number } from "./journal-view";

export function ResultBars({
  items,
  currency,
}: {
  items: { label: string; value: number }[];
  currency: string;
}) {
  if (!items.length)
    return <p className="py-10 text-center text-sm text-muted-foreground">Aucune clôture.</p>;
  const max = Math.max(...items.map((item) => Math.abs(item.value)), 1e-10);
  return (
    <figure className="space-y-3">
      <div className="space-y-3" aria-label={`Résultats nets en ${currency}`}>
        {items.map((item) => (
          <div key={item.label} title={`${item.label} : ${number(item.value)} ${currency}`}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-muted-foreground">{item.label}</span>
              <span className="shrink-0 font-medium">
                <PnlValue value={item.value} currency="" />
              </span>
            </div>
            <div
              className="relative h-4 overflow-hidden rounded bg-secondary/50"
              aria-hidden="true"
            >
              <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--baseline)]" />
              <span
                className={`absolute inset-y-0 rounded-sm ${item.value < 0 ? "bg-loss" : "bg-profit"}`}
                style={{
                  width: `${(Math.abs(item.value) / max) * 50}%`,
                  ...(item.value < 0 ? { right: "50%" } : { left: "50%" }),
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <figcaption className="flex justify-between text-[11px] text-muted-foreground">
        <span>Pertes</span>
        <span>{currency}</span>
        <span>Gains</span>
      </figcaption>
    </figure>
  );
}

export function HistorySummary({ view }: { view: JournalView }) {
  const metrics = view.overview.metrics;
  const closedPct = metrics.totalTrades ? (metrics.closedTrades / metrics.totalTrades) * 100 : 0;
  return (
    <section aria-label="Résumé de l’historique" className="grid gap-3 sm:grid-cols-2">
      <div className="card-sheen min-w-0 rounded-xl border bg-card p-4 sm:p-5">
        <p className="text-xs text-muted-foreground">Résultat clôturé</p>
        <div className="mt-2 break-words text-2xl font-semibold">
          {view.currencyScope.monetary ? (
            <PnlValue value={metrics.netPnl} currency={view.currencyScope.currency ?? ""} />
          ) : (
            "—"
          )}
        </div>
      </div>
      <div className="card-sheen min-w-0 rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">Positions</span>
          <strong className="text-lg">{metrics.totalTrades}</strong>
        </div>
        <div
          className="mt-3 flex h-3 overflow-hidden rounded-full bg-secondary"
          role="img"
          aria-label={`${metrics.closedTrades} position${metrics.closedTrades === 1 ? "" : "s"} clôturée${metrics.closedTrades === 1 ? "" : "s"}, ${metrics.openTrades} ouverte${metrics.openTrades === 1 ? "" : "s"}`}
        >
          <span className="bg-brand" style={{ width: `${closedPct}%` }} />
          <span
            className="bg-[var(--series-2)]"
            style={{ width: metrics.totalTrades ? `${100 - closedPct}%` : "0%" }}
          />
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
            {metrics.closedTrades} {metrics.closedTrades === 1 ? "clôturée" : "clôturées"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--series-2)]" aria-hidden="true" />
            {metrics.openTrades} {metrics.openTrades === 1 ? "ouverte" : "ouvertes"}
          </span>
        </div>
      </div>
    </section>
  );
}

export function HistoryAnalysis({ view }: { view: JournalView }) {
  const currency = view.currencyScope.currency ?? "";
  const closed = view.projectedTrades.filter((trade) => trade.status !== "open");
  const days = dailyStats(closed, view.timeZone).slice(-14);
  const symbols = new Map<string, number>();
  closed.forEach((trade) =>
    symbols.set(trade.symbol, (symbols.get(trade.symbol) ?? 0) + trade.netPnl),
  );
  const metrics = view.overview.metrics;
  const neutral = metrics.closedTrades - metrics.wins - metrics.losses;
  const winDegrees = metrics.closedTrades ? (metrics.wins / metrics.closedTrades) * 360 : 0;
  const lossDegrees = metrics.closedTrades
    ? ((metrics.wins + metrics.losses) / metrics.closedTrades) * 360
    : 0;
  const monetaryEmpty = (
    <p className="py-10 text-sm text-muted-foreground">Devises différentes : choisis un compte.</p>
  );
  return (
    <section
      aria-label="Graphiques d’analyse de la sélection"
      className="grid min-w-0 gap-4 xl:grid-cols-2"
    >
      <Panel title="Résultat cumulé">
        {view.currencyScope.monetary ? (
          <EquityChart points={view.overview.equity} currency={currency} detailed />
        ) : (
          monetaryEmpty
        )}
      </Panel>
      <Panel title="Réussite">
        <div className="flex flex-wrap items-center justify-center gap-8 py-6">
          <div
            className="relative flex h-36 w-36 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--profit) ${winDegrees}deg, var(--loss) ${winDegrees}deg ${lossDegrees}deg, var(--secondary) ${lossDegrees}deg)`,
            }}
            role="img"
            aria-label={`Réussite : ${metrics.winRate == null ? "indisponible" : `${number(metrics.winRate * 100, 1)} %`} sur ${metrics.closedTrades} position${metrics.closedTrades === 1 ? "" : "s"} clôturée${metrics.closedTrades === 1 ? "" : "s"}`}
          >
            <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-card">
              <strong className="text-2xl">
                {metrics.winRate == null ? "—" : `${number(metrics.winRate * 100, 1)} %`}
              </strong>
              <span className="text-xs text-muted-foreground">
                {metrics.closedTrades} {metrics.closedTrades === 1 ? "clôture" : "clôtures"}
              </span>
            </div>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex gap-6">
              <dt className="text-profit">Gagnants</dt>
              <dd className="ml-auto font-semibold">{metrics.wins}</dd>
            </div>
            <div className="flex gap-6">
              <dt className="text-loss">Perdants</dt>
              <dd className="ml-auto font-semibold">{metrics.losses}</dd>
            </div>
            <div className="flex gap-6">
              <dt className="text-muted-foreground">À l’équilibre</dt>
              <dd className="ml-auto font-semibold">{neutral}</dd>
            </div>
          </dl>
        </div>
      </Panel>
      <Panel title="Par jour · 14 jours actifs">
        {view.currencyScope.monetary ? (
          <ResultBars
            items={days.map((day) => ({
              label: day.date.split("-").reverse().join("."),
              value: day.netPnl,
            }))}
            currency={currency}
          />
        ) : (
          monetaryEmpty
        )}
      </Panel>
      <Panel title="Par crypto">
        {view.currencyScope.monetary ? (
          <ResultBars
            items={[...symbols]
              .sort((a, b) => b[1] - a[1])
              .map(([label, value]) => ({ label: label.replace("USDT", " / USDT"), value }))}
            currency={currency}
          />
        ) : (
          monetaryEmpty
        )}
      </Panel>
      <p className="text-[11px] text-muted-foreground xl:col-span-2">
        Positions entièrement clôturées · après frais · {view.timeZone}
      </p>
    </section>
  );
}
