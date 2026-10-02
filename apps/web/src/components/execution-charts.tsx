import type { RoundTrip } from "@luxalgo/journal-core";
import { executionChart, type ChartExecution } from "@/lib/execution-chart";
import { number, timestamp } from "@/components/journal-view";

export function ExecutionCharts({
  trade,
  fills,
  currency,
  timeZone,
}: {
  trade: RoundTrip;
  fills: ChartExecution[];
  currency: string;
  timeZone: string;
}) {
  const { events, complete } = executionChart(trade, fills);
  if (!events.length)
    return (
      <p className="text-sm text-muted-foreground">
        Aucune exécution disponible pour tracer ce trade.
      </p>
    );
  const first = events[0]!.time,
    last = events.at(-1)!.time;
  const span = Math.max(last - first, 60_000);
  const start = first - span * 0.08,
    end = last + span * 0.08;
  const x = (time: number) => 90 + ((time - start) / (end - start)) * 690;
  const prices = events.map((event) => event.price);
  const low = Math.min(...prices),
    high = Math.max(...prices);
  const padding = Math.max(high - low, Math.abs(high) * 0.002, 0.00001) * 0.25;
  const priceY = (price: number) =>
    230 - ((price - low + padding) / (high - low + padding * 2)) * 190;
  const maxPosition = Math.max(...events.map((event) => event.position), 1e-10);
  const quantityY = (quantity: number) => 230 - (quantity / maxPosition) * 190;
  const label = (event: (typeof events)[number]) =>
    `${event.kind === "entry" ? "Entrée" : "Sortie"} · ${timestamp(event.executedAt, timeZone)} · ${number(event.quantity, 4)} unités à ${number(event.price, 5)} ${currency}`;
  const marks = (y: (event: (typeof events)[number]) => number) =>
    events.map((event) => {
      const cx = x(event.time),
        cy = y(event);
      return event.kind === "entry" ? (
        <circle
          key={event.id}
          cx={cx}
          cy={cy}
          r="7"
          fill="var(--brand)"
          stroke="var(--background)"
          strokeWidth="2"
          tabIndex={0}
          role="img"
          aria-label={label(event)}
        >
          <title>{label(event)}</title>
        </circle>
      ) : (
        <polygon
          key={event.id}
          points={`${cx},${cy - 9} ${cx + 9},${cy} ${cx},${cy + 9} ${cx - 9},${cy}`}
          fill="var(--series-2)"
          stroke="var(--background)"
          strokeWidth="2"
          tabIndex={0}
          role="img"
          aria-label={label(event)}
        >
          <title>{label(event)}</title>
        </polygon>
      );
    });
  const timeAxis = (
    <>
      <text x="90" y="265" fill="var(--muted-foreground)" fontSize="11">
        {timestamp(events[0]!.executedAt, timeZone)}
      </text>
      <text x="780" y="265" textAnchor="end" fill="var(--muted-foreground)" fontSize="11">
        {timestamp(events.at(-1)!.executedAt ?? null, timeZone)}
      </text>
    </>
  );
  let step = `M ${x(first).toFixed(2)} 230`;
  for (const event of events)
    step += ` H ${x(event.time).toFixed(2)} V ${quantityY(event.position).toFixed(2)}`;
  step += ` H ${x(end).toFixed(2)}`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-brand" />
          Entrée {trade.direction === "long" ? "(achat)" : "(vente)"}
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 rotate-45 bg-[var(--series-2)]" />
          Sortie {trade.direction === "long" ? "(vente)" : "(achat)"}
        </span>
      </div>
      <figure>
        <h3 className="mb-2 text-sm font-medium">Prix des entrées et sorties</h3>
        <div className="overflow-x-auto">
          <svg
            viewBox="0 0 820 285"
            className="min-w-[540px] w-full"
            role="img"
            aria-label={`Prix d’exécution de ${trade.symbol} : ${events.filter((e) => e.kind === "entry").length} entrées et ${events.filter((e) => e.kind === "exit").length} sorties`}
          >
            {[0, 0.5, 1].map((ratio) => {
              const price = low - padding + ratio * (high - low + 2 * padding);
              return (
                <g key={ratio}>
                  <line
                    x1="90"
                    x2="780"
                    y1={priceY(price)}
                    y2={priceY(price)}
                    stroke="var(--gridline)"
                  />
                  <text
                    x="80"
                    y={priceY(price) + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="var(--muted-foreground)"
                  >
                    {number(price, 5)}
                  </text>
                </g>
              );
            })}
            <text x="90" y="20" fill="var(--muted-foreground)" fontSize="11">
              Prix · {currency}
            </text>
            {marks((event) => priceY(event.price))}
            {timeAxis}
          </svg>
        </div>
        <figcaption className="mt-2 text-xs text-muted-foreground">
          Points issus des exécutions du journal. Survolez un point pour voir le prix et la
          quantité. Les points ne représentent pas le cours du marché entre les ordres · {timeZone}.
        </figcaption>
      </figure>
      {complete ? (
        <figure>
          <h3 className="mb-2 text-sm font-medium">Quantité en position après chaque exécution</h3>
          <div className="overflow-x-auto">
            <svg
              viewBox="0 0 820 285"
              className="min-w-[540px] w-full"
              role="img"
              aria-label={`Quantité restante : ${number(trade.openQuantity, 4)} unités`}
            >
              {[0, 0.5, 1].map((ratio) => (
                <g key={ratio}>
                  <line
                    x1="90"
                    x2="780"
                    y1={quantityY(maxPosition * ratio)}
                    y2={quantityY(maxPosition * ratio)}
                    stroke="var(--gridline)"
                  />
                  <text
                    x="80"
                    y={quantityY(maxPosition * ratio) + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="var(--muted-foreground)"
                  >
                    {number(maxPosition * ratio, 4)}
                  </text>
                </g>
              ))}
              <text x="90" y="20" fill="var(--muted-foreground)" fontSize="11">
                Quantité · unités
              </text>
              <path d={step} fill="none" stroke="var(--brand)" strokeWidth="2" />
              {marks((event) => quantityY(event.position))}
              {timeAxis}
            </svg>
          </div>
          <figcaption className="mt-2 text-xs text-muted-foreground">
            Les entrées augmentent la quantité, les sorties la réduisent. Restant :{" "}
            {number(trade.openQuantity, 4)} unités
            {trade.status === "open" ? " · position encore ouverte" : " · position clôturée"}.
          </figcaption>
        </figure>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          Historique incomplet : la courbe de quantité ne peut pas être reconstituée avec certitude.
        </p>
      )}
      <p className="text-xs text-muted-foreground sm:hidden">
        Faites défiler les graphiques horizontalement. Les valeurs détaillées sont dans le tableau
        des exécutions ci-dessous.
      </p>
    </div>
  );
}
