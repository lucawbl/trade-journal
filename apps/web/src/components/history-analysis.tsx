import { dailyStats } from "@luxalgo/journal-core";
import type { JournalView } from "@/server/journal-view";
import { EquityChart, Panel, number } from "./journal-view";

export function ResultBars({
  items,
  currency,
}: {
  items: { label: string; value: number }[];
  currency: string;
}) {
  if (!items.length)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Aucune clôture dans cette sélection.
      </p>
    );
  const max = Math.max(...items.map((item) => Math.abs(item.value)), 1e-10);
  const height = Math.max(110, items.length * 38 + 30);
  return (
    <figure>
      <svg
        viewBox={`0 0 540 ${height}`}
        className="w-full"
        role="img"
        aria-label={`Résultats nets : ${items.map((item) => `${item.label} ${number(item.value)} ${currency}`).join(", ")}`}
      >
        <line x1="290" x2="290" y1="8" y2={height - 15} stroke="var(--baseline)" />
        {items.map((item, index) => {
          const width = (Math.abs(item.value) / max) * 155;
          const y = index * 38 + 22;
          return (
            <g key={item.label}>
              <text x="0" y={y + 4} fill="var(--muted-foreground)" fontSize="13">
                {item.label}
              </text>
              <rect
                x={item.value < 0 ? 290 - width : 290}
                y={y - 10}
                width={width}
                height="17"
                rx="3"
                fill={item.value < 0 ? "var(--loss)" : "var(--profit)"}
              >
                <title>{`${item.label} : ${number(item.value)} ${currency}`}</title>
              </rect>
              <text x="535" y={y + 4} textAnchor="end" fill="var(--foreground)" fontSize="13">
                {item.value > 0 ? "+" : ""}
                {number(item.value)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs text-muted-foreground">
        Résultat net en {currency} · pertes à gauche, gains à droite.
      </figcaption>
    </figure>
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
    <p className="py-10 text-sm text-muted-foreground">
      Choisis un compte pour analyser ses résultats dans sa devise.
    </p>
  );
  return (
    <section
      aria-label="Graphiques d’analyse de la sélection"
      className="grid min-w-0 gap-4 xl:grid-cols-2"
    >
      <Panel title="Évolution du résultat">
        <p className="mb-3 text-xs text-muted-foreground">
          Cumul des positions entièrement clôturées de ta sélection.
        </p>
        {view.currencyScope.monetary ? (
          <EquityChart points={view.overview.equity} currency={currency} detailed />
        ) : (
          monetaryEmpty
        )}
      </Panel>
      <Panel title="Gagnants et perdants">
        <div className="flex flex-wrap items-center justify-center gap-8 py-6">
          <div
            className="relative flex h-36 w-36 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--profit) ${winDegrees}deg, var(--loss) ${winDegrees}deg ${lossDegrees}deg, var(--secondary) ${lossDegrees}deg)`,
            }}
            aria-hidden="true"
          >
            <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-card">
              <strong className="text-2xl">
                {metrics.winRate == null ? "—" : `${number(metrics.winRate * 100, 1)} %`}
              </strong>
              <span className="text-xs text-muted-foreground">de réussite</span>
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
        <p className="text-xs text-muted-foreground">
          {metrics.closedTrades} clôtures · réussite :{" "}
          {metrics.winRate == null ? "—" : `${number(metrics.winRate * 100, 1)} %`} ·{" "}
          {metrics.openTrades} positions encore ouvertes, exclues de ce calcul.
        </p>
      </Panel>
      <Panel title="Résultat par jour">
        <p className="mb-4 text-xs text-muted-foreground">
          Les 14 derniers jours avec une clôture · {view.timeZone}.
        </p>
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
      <Panel title="Résultat par crypto">
        <p className="mb-4 text-xs text-muted-foreground">
          Compare les contributions des trades clôturés, après frais.
        </p>
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
    </section>
  );
}
