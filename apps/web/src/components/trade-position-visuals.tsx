import type { RoundTrip } from "@luxalgo/journal-core";
import { number, priceNumber } from "@/lib/journal-format";
import { Panel, PnlValue } from "./journal-view";

/** Summaries of recorded executions only; no current market price or unrealized result. */
export type TradePositionSummary = Pick<
  RoundTrip,
  | "quantity"
  | "openQuantity"
  | "avgEntry"
  | "avgExit"
  | "direction"
  | "grossPnl"
  | "fees"
  | "netPnl"
  | "status"
>;
export function TradePositionVisuals({
  trade,
  currency,
}: {
  trade: TradePositionSummary;
  currency: string;
}) {
  const remaining =
    trade.quantity > 0 ? Math.min(1, Math.max(0, trade.openQuantity / trade.quantity)) : null;
  const circumference = 2 * Math.PI * 44;
  const delta =
    trade.avgExit != null && trade.avgEntry !== 0
      ? ((trade.avgExit - trade.avgEntry) / Math.abs(trade.avgEntry)) *
        (trade.direction === "long" ? 1 : -1) *
        100
      : null;
  const priceValues = [trade.avgEntry, ...(trade.avgExit == null ? [] : [trade.avgExit])];
  const low = Math.min(...priceValues);
  const span = Math.max(...priceValues) - low;
  const priceY = (value: number) => (span ? 92 - ((value - low) / span) * 45 : 68);
  const pnlItems = [
    { label: "Brut", value: trade.grossPnl },
    { label: "Frais", value: -trade.fees },
    { label: "Net", value: trade.netPnl },
  ];
  const pnlMax = Math.max(...pnlItems.map((item) => Math.abs(item.value)), 1e-10);
  return (
    <section className="grid min-w-0 gap-4 xl:grid-cols-3" aria-label="Position en graphiques">
      <Panel title="Quantité">
        <div className="flex flex-wrap items-center justify-center gap-5">
          <svg
            viewBox="0 0 120 120"
            className="h-36 w-36 shrink-0"
            role="img"
            aria-label={
              remaining == null
                ? "Quantité entrée indisponible"
                : `${number(remaining * 100, 1)} % de la quantité entrée reste en position`
            }
          >
            <circle
              cx="60"
              cy="60"
              r="44"
              fill="none"
              stroke={remaining == null ? "var(--secondary)" : "var(--series-2)"}
              strokeWidth="12"
            />
            {remaining != null && (
              <circle
                cx="60"
                cy="60"
                r="44"
                fill="none"
                stroke="var(--brand)"
                strokeWidth="12"
                strokeDasharray={`${circumference * remaining} ${circumference}`}
                transform="rotate(-90 60 60)"
              />
            )}
            <text
              x="60"
              y="59"
              textAnchor="middle"
              fill="var(--foreground)"
              fontSize="19"
              fontWeight="600"
            >
              {remaining == null ? "—" : `${number(remaining * 100, 1)} %`}
            </text>
            <text x="60" y="77" textAnchor="middle" fill="var(--muted-foreground)" fontSize="10">
              restant
            </text>
          </svg>
          <dl className="min-w-0 space-y-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Entrée cumulée</dt>
              <dd className="tnum mt-1 break-all font-medium">{number(trade.quantity, 6)}</dd>
            </div>
            <div>
              <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-[var(--series-2)]" aria-hidden="true" />
                Sortie
              </dt>
              <dd className="tnum mt-1 break-all font-medium">
                {number(Math.max(0, trade.quantity - trade.openQuantity), 6)}
              </dd>
            </div>
            <div>
              <dt className="inline-flex items-center gap-1.5 text-brand">
                <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
                Restant
              </dt>
              <dd className="tnum mt-1 break-all font-medium">{number(trade.openQuantity, 6)}</dd>
            </div>
          </dl>
        </div>
      </Panel>
      <Panel title="Prix moyens exécutés">
        <div className="text-right text-lg font-semibold">
          <span
            className={
              delta == null ? "text-muted-foreground" : delta < 0 ? "text-loss" : "text-profit"
            }
          >
            {delta == null ? "—" : `${delta > 0 ? "+" : ""}${number(delta)} %`}
          </span>
        </div>
        <svg
          viewBox="0 0 350 145"
          className="mt-2 w-full"
          role="img"
          aria-label={`Prix moyen d’entrée ${priceNumber(trade.avgEntry)} ${currency}, ${trade.avgExit == null ? "aucune sortie" : `prix moyen de sortie ${priceNumber(trade.avgExit)} ${currency}`}. Écart brut dans le sens du trade, avant frais.`}
        >
          <line x1="42" x2="307" y1="105" y2="105" stroke="var(--border)" />
          {trade.avgExit != null && (
            <line
              x1="65"
              x2="280"
              y1={priceY(trade.avgEntry)}
              y2={priceY(trade.avgExit)}
              stroke="var(--brand)"
              strokeWidth="2"
              strokeDasharray="4 5"
            />
          )}
          <circle cx="65" cy={priceY(trade.avgEntry)} r="6" fill="var(--brand)" />
          {trade.avgExit != null && (
            <circle cx="280" cy={priceY(trade.avgExit)} r="6" fill="var(--series-2)" />
          )}
          <text x="12" y="23" fill="var(--foreground)" fontSize="15">
            {priceNumber(trade.avgEntry)}
          </text>
          <text x="338" y="23" textAnchor="end" fill="var(--foreground)" fontSize="15">
            {trade.avgExit == null ? "—" : priceNumber(trade.avgExit)}
          </text>
          <text x="65" y="130" textAnchor="middle" fill="var(--muted-foreground)" fontSize="13">
            Entrée
          </text>
          <text x="280" y="130" textAnchor="middle" fill="var(--muted-foreground)" fontSize="13">
            Sortie
          </text>
        </svg>
        <p className="text-[11px] text-muted-foreground">
          {currency} · écart brut {trade.direction === "long" ? "long" : "short"}
        </p>
      </Panel>
      <Panel title="Résultat enregistré">
        <div className="mb-5 break-words text-2xl font-semibold">
          <PnlValue value={trade.netPnl} currency={currency} />
        </div>
        <div className="space-y-3" aria-label="Résultat avant frais, frais et résultat net">
          {pnlItems.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <PnlValue value={item.value} currency="" />
              </div>
              <div className="relative h-2 overflow-hidden rounded bg-secondary" aria-hidden="true">
                <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--baseline)]" />
                <span
                  className={`absolute inset-y-0 rounded-sm ${item.value < 0 ? "bg-loss" : "bg-profit"}`}
                  style={{
                    width: `${(Math.abs(item.value) / pnlMax) * 50}%`,
                    ...(item.value < 0 ? { right: "50%" } : { left: "50%" }),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        {trade.status === "open" && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Sorties partielles et frais · hors variation latente
          </p>
        )}
      </Panel>
    </section>
  );
}
