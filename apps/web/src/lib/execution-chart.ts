import type { RoundTrip } from "@luxalgo/journal-core";

export interface ChartExecution {
  id: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  executedAt: string;
}

/** Attribute reversal fills to this trade only, using its recorded exit quantities. */
export function executionChart(trade: RoundTrip, fills: ChartExecution[]) {
  const order = new Map(trade.executionIds.map((id, index) => [id, index]));
  const exits = new Map<string, number>();
  for (const exit of trade.exits)
    exits.set(exit.executionId, (exits.get(exit.executionId) ?? 0) + exit.quantity);
  const sorted = fills
    .filter(
      (fill) =>
        order.has(fill.id) &&
        Number.isFinite(Date.parse(fill.executedAt)) &&
        Number.isFinite(fill.price) &&
        Number.isFinite(fill.quantity) &&
        fill.quantity > 0,
    )
    .sort(
      (a, b) =>
        Date.parse(a.executedAt) - Date.parse(b.executedAt) || order.get(a.id)! - order.get(b.id)!,
    );
  let entryRemaining = trade.quantity;
  const entrySide = trade.direction === "long" ? "buy" : "sell";
  // A reversal's first fill may also close the preceding trade. Its excess
  // belongs to that trade, rather than replacing later scale-in quantities.
  let entryExcess = Math.max(
    0,
    sorted.filter((fill) => fill.side === entrySide).reduce((sum, fill) => sum + fill.quantity, 0) -
      trade.quantity,
  );
  let position = 0;
  const events = sorted.flatMap((fill) => {
    const entry = fill.side === entrySide;
    const excess = entry ? Math.min(fill.quantity, entryExcess) : 0;
    entryExcess -= excess;
    const quantity = entry
      ? Math.min(fill.quantity - excess, entryRemaining)
      : (exits.get(fill.id) ?? 0);
    if (quantity <= 0) return [];
    if (entry) entryRemaining -= quantity;
    position += entry ? quantity : -quantity;
    if (Math.abs(position) < Math.max(1, trade.quantity) * 1e-10) position = 0;
    return [
      {
        id: fill.id,
        time: Date.parse(fill.executedAt),
        price: fill.price,
        quantity,
        position,
        kind: entry ? ("entry" as const) : ("exit" as const),
        executedAt: fill.executedAt,
      },
    ];
  });
  const tolerance = Math.max(1, trade.quantity) * 1e-8;
  const complete =
    Math.abs(entryRemaining) <= tolerance &&
    Math.abs(position - trade.openQuantity) <= tolerance &&
    events.every((event) => event.position >= -tolerance);
  return { events, complete };
}
