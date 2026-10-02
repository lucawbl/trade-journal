import { calendarMonthFromDays, dayKeyOf, readFilters } from "@luxalgo/journal-core";
import { JournalFilters } from "@/components/journal-filters";
import { JournalShell, Metric, Panel, PnlValue, number } from "@/components/journal-view";
import { journalMonth } from "@/lib/journal-month";
import { readJournalView, requireJournalSession } from "@/server/journal-view";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireJournalSession();
  const params = await searchParams;
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
  const monthLink = (month: string) => `/calendar?${new URLSearchParams({ ...filters, month })}`;
  const dayLink = (date: string) =>
    `/trades?${new URLSearchParams({ ...filters, from: date, to: date })}`;
  const activity = view.overview.days.filter((day) => day.date.startsWith(selection.key));
  return (
    <JournalShell title="Résultats par jour" active="calendar">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Retrouvez le résultat de chaque journée de clôture. Cliquez sur un jour pour voir ses trades
        ; une sortie partielle reste rattachée à une position ouverte jusqu’à sa clôture complète.
      </p>
      <Panel title="Comptes et symboles">
        <JournalFilters
          action="/calendar"
          accounts={view.accounts}
          filters={filters}
          month={selection.key}
          closedOnly
        />
      </Panel>
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
          <a href={monthLink(today.slice(0, 7))} className="rounded-md border px-3 py-2 text-sm">
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
        <p role="status" className="rounded-lg border p-4 text-sm text-muted-foreground">
          Sélectionnez un compte pour afficher les montants dans une devise unique.
        </p>
      )}
      <section aria-label="Bilan du mois" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="P&L net du mois"
          value={monetary ? <PnlValue value={calendar.monthNetPnl} currency={currency} /> : "—"}
          hint="Trades entièrement clôturés"
        />
        <Metric label="Trades clôturés" value={calendar.monthTrades} hint="Par date de clôture" />
        <Metric
          label="Jours de trading"
          value={calendar.tradingDays}
          hint="Jours avec au moins une clôture"
        />
        <Metric
          label="Jours gagnants"
          value={monetary ? calendar.winningDays : "—"}
          hint="Jours avec un résultat net positif"
        />
      </section>
      <Panel title={`Clôtures de ${selection.label}`}>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((day) => (
            <div key={day} className="pb-2 text-center text-xs text-muted-foreground">
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
                  aria-current={day.date === today ? "date" : undefined}
                  className={`min-h-20 min-w-0 rounded-md border p-1 text-center hover:border-brand sm:min-h-28 sm:p-3 ${day.date === today ? "border-brand" : ""} ${day.trades && monetary ? (day.netPnl > 0 ? "bg-profit/10" : day.netPnl < 0 ? "bg-loss/10" : "bg-secondary") : ""}`}
                >
                  <span className="block text-sm">{Number(day.date.slice(-2))}</span>
                  {day.trades > 0 ? (
                    <>
                      <span className="mt-1 hidden text-xs sm:block">
                        {monetary ? <PnlValue value={day.netPnl} currency={currency} /> : "—"}
                      </span>
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        {day.trades} trade{day.trades === 1 ? "" : "s"}
                      </span>
                    </>
                  ) : (
                    <span className="mt-2 block text-xs text-muted-foreground">—</span>
                  )}
                </a>
              ),
            )}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Cliquez sur un jour pour consulter ses trades clôturés. Les positions encore ouvertes et
          les sorties partielles sont exclues · Fuseau : {view.timeZone}.
        </p>
      </Panel>
      <Panel title="Résultats quotidiens">
        {activity.length ? (
          <div className="space-y-3">
            {activity.map((day) => (
              <a
                key={day.date}
                href={dayLink(day.date)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm hover:border-brand"
              >
                <span>
                  {day.date} · {day.trades} trade{day.trades === 1 ? "" : "s"}
                </span>
                {monetary ? (
                  <PnlValue value={day.netPnl} currency={currency} />
                ) : (
                  <span>Devise à sélectionner</span>
                )}
              </a>
            ))}
          </div>
        ) : (
          <p className="py-4 text-sm text-muted-foreground">
            Aucune clôture complète ce mois-ci pour cette sélection.
          </p>
        )}
      </Panel>
    </JournalShell>
  );
}
