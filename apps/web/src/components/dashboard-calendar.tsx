import { calendarMonthFromDays, dayKeyOf, readFilters } from "@luxalgo/journal-core";
import { JournalFilters } from "@/components/journal-filters";
import { Panel, PnlValue, number } from "@/components/journal-view";
import {
  JournalVisualColumns,
  JournalVisualDonut,
  JournalVisualMetric,
} from "@/components/journal-visual-charts";
import { journalMonth } from "@/lib/journal-month";
import { readJournalView } from "@/server/journal-view";

export function DashboardCalendar({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const value = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;
  const filters = { ...readFilters({ get: (key) => value(key) ?? null }), status: "closed" };
  delete filters.from;
  delete filters.to;
  const view = readJournalView(filters);
  const today = dayKeyOf(new Date().toISOString(), view.timeZone);
  const selection = journalMonth(value("month"), today);
  const calendar = calendarMonthFromDays(view.overview.days, selection.year, selection.month);
  const { monetary, currency: scopeCurrency } = view.currencyScope;
  const currency = scopeCurrency ?? "";
  const monthLink = (month: string) =>
    `/?${new URLSearchParams({ ...filters, view: "calendar", month })}`;
  const dayLink = (date: string) =>
    `/trades?${new URLSearchParams({ ...filters, from: date, to: date })}`;
  const days = calendar.weeks.flatMap((week) => week.days).filter((day) => day !== null);
  const activity = days.filter((day) => day.trades > 0);
  const losingDays = activity.filter((day) => day.netPnl < 0).length;
  const maximum = Math.max(
    ...activity.map((day) => (monetary ? Math.abs(day.netPnl) : day.trades)),
    1e-10,
  );
  const filtered = Object.entries(filters).some(
    ([key, entry]) => key !== "status" && Boolean(entry),
  );
  return (
    <>
      <details className="rounded-xl border bg-card p-4" open={filtered || !monetary}>
        <summary className="cursor-pointer text-sm font-medium">
          Comptes et symboles{filtered ? " · sélection active" : ""}
        </summary>
        <div className="mt-4">
          <JournalFilters
            action="/"
            accounts={view.accounts}
            filters={filters}
            month={selection.key}
            closedOnly
            extraFields={{ view: "calendar" }}
          />
        </div>
      </details>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold capitalize">{selection.label}</h2>
        <nav aria-label="Choix du mois" className="flex gap-2">
          <a
            href={monthLink(selection.previous)}
            aria-label="Mois précédent"
            className="rounded-md border px-3 py-2 text-sm"
          >
            ←
          </a>
          <a href={monthLink(today.slice(0, 7))} className="rounded-md border px-3 py-2 text-xs">
            Ce mois
          </a>
          <a
            href={monthLink(selection.next)}
            aria-label="Mois suivant"
            className="rounded-md border px-3 py-2 text-sm"
          >
            →
          </a>
        </nav>
      </div>
      {!monetary && (
        <p role="status" className="text-xs text-muted-foreground">
          Choisis un compte pour afficher les montants dans sa devise.
        </p>
      )}
      <section aria-label="Bilan du mois" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <JournalVisualMetric
          label="P&L du mois"
          value={monetary ? <PnlValue value={calendar.monthNetPnl} currency={currency} /> : "—"}
        />
        <JournalVisualMetric label="Clôtures" value={calendar.monthTrades} />
        <JournalVisualMetric label="Jours actifs" value={calendar.tradingDays} />
        <JournalVisualMetric
          label="Jours gagnants"
          value={
            monetary && calendar.tradingDays
              ? `${number((calendar.winningDays / calendar.tradingDays) * 100, 0)} %`
              : "—"
          }
        />
      </section>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Clôtures du mois">
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((day) => (
              <div key={day} className="pb-2 text-center text-[10px] text-muted-foreground">
                {day}
              </div>
            ))}
            {calendar.weeks
              .flatMap((week) => week.days)
              .map((day, index) =>
                !day ? (
                  <div key={`blank-${index}`} aria-hidden="true" />
                ) : (
                  <a
                    key={day.date}
                    href={dayLink(day.date)}
                    aria-label={`${day.date} : ${day.trades} trades clôturés${monetary ? `, ${number(day.netPnl)} ${currency}` : ""}`}
                    title={`${day.trades} clôtures${monetary ? ` · ${number(day.netPnl)} ${currency}` : ""}`}
                    aria-current={day.date === today ? "date" : undefined}
                    className={`min-h-20 min-w-0 rounded-md border p-1 text-center hover:border-brand sm:min-h-24 sm:p-2 ${day.date === today ? "border-brand" : ""} ${day.trades && monetary ? (day.netPnl > 0 ? "bg-profit/10" : day.netPnl < 0 ? "bg-loss/10" : "bg-secondary") : ""}`}
                  >
                    <span className="block text-sm">{Number(day.date.slice(-2))}</span>
                    {day.trades > 0 ? (
                      <>
                        <span className="mt-1 hidden text-[10px] sm:block">
                          {monetary ? <PnlValue value={day.netPnl} currency={currency} /> : ""}
                        </span>
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          {day.trades}
                          <span className="sr-only"> clôtures</span>
                        </span>
                        <span
                          aria-hidden="true"
                          className="mt-2 block h-1 overflow-hidden rounded-full bg-secondary"
                        >
                          <span
                            className={`block h-full rounded-full ${monetary ? (day.netPnl < 0 ? "bg-loss" : day.netPnl > 0 ? "bg-profit" : "bg-muted-foreground") : "bg-brand"}`}
                            style={{
                              width: `${((monetary ? Math.abs(day.netPnl) : day.trades) / maximum) * 100}%`,
                            }}
                          />
                        </span>
                      </>
                    ) : (
                      <span className="mt-3 block text-xs text-muted-foreground">—</span>
                    )}
                  </a>
                ),
              )}
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-2 text-[10px] text-muted-foreground">
            <span>Jour → trades</span>
            <span>{view.timeZone}</span>
          </div>
        </Panel>
        <div className="grid min-w-0 gap-5">
          <Panel title="Résultats quotidiens">
            <JournalVisualColumns
              items={days.map((day) => ({
                label: day.date,
                axisLabel: day.date.slice(-2),
                value: monetary ? day.netPnl : day.trades,
                href: dayLink(day.date),
                trades: day.trades,
              }))}
              currency={monetary ? currency : ""}
              monetary={monetary}
            />
          </Panel>
          <Panel title="Jours actifs">
            <JournalVisualDonut
              segments={
                monetary
                  ? [
                      { label: "Gagnants", value: calendar.winningDays, color: "var(--profit)" },
                      { label: "Perdants", value: losingDays, color: "var(--loss)" },
                      {
                        label: "Équilibre",
                        value: calendar.tradingDays - calendar.winningDays - losingDays,
                        color: "var(--baseline)",
                      },
                    ]
                  : [
                      { label: "Avec clôture", value: calendar.tradingDays, color: "var(--brand)" },
                      {
                        label: "Sans clôture",
                        value: days.length - calendar.tradingDays,
                        color: "var(--secondary)",
                      },
                    ]
              }
              value={String(calendar.tradingDays)}
              label="jours actifs"
            />
          </Panel>
        </div>
      </div>
      <details className="rounded-lg border px-4 py-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Périmètre</summary>
        <p className="mt-3">
          Positions entièrement clôturées, par date de clôture. Les positions ouvertes et leurs
          sorties partielles sont exclues.
        </p>
      </details>
    </>
  );
}
