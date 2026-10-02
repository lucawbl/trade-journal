import { readFilters } from "@luxalgo/journal-core";
import { JournalShell, Panel, SummaryMetrics, TradeTable } from "@/components/journal-view";
import { readJournalView, requireJournalSession } from "@/server/journal-view";

export const dynamic = "force-dynamic";
type Params = Record<string, string | string[] | undefined>;

export default async function TradesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireJournalSession();
  const params = await searchParams;
  const value = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const view = readJournalView(readFilters({ get: value }));
  const inputClass = "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm";
  return (
    <JournalShell title="Historique des trades" active="trades">
      <Panel title="Filtrer l’historique">
        <form
          action="/trades"
          method="get"
          className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className="text-xs text-muted-foreground">
            Compte
            <select name="accounts" defaultValue={value("accounts")} className={inputClass}>
              <option value="">Tous les comptes</option>
              {view.accounts.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Symbole
            <input
              name="symbol"
              defaultValue={value("symbol")}
              placeholder="DOGEUSDT"
              className={inputClass}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Statut
            <select name="status" defaultValue={value("status")} className={inputClass}>
              {[
                ["", "Tous les statuts"],
                ["open", "Ouverts / sorties partielles"],
                ["closed", "Clôturés"],
                ["win", "Gagnants"],
                ["loss", "Perdants"],
                ["breakeven", "Équilibre"],
              ].map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Sens
            <select name="direction" defaultValue={value("direction")} className={inputClass}>
              <option value="">Tous</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Du
            <input type="date" name="from" defaultValue={value("from")} className={inputClass} />
          </label>
          <label className="text-xs text-muted-foreground">
            Au
            <input type="date" name="to" defaultValue={value("to")} className={inputClass} />
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Appliquer
          </button>
          <a
            href="/trades"
            className="px-3 py-2 text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Réinitialiser
          </a>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Dates de clôture, ou d’ouverture pour les positions ouvertes · Fuseau : {view.timeZone}
        </p>
      </Panel>
      <SummaryMetrics view={view} />
      <Panel title={`${view.rows.length} trade${view.rows.length === 1 ? "" : "s"}`}>
        <TradeTable view={view} />
        <p className="mt-4 text-xs text-muted-foreground">
          Cliquez sur un symbole pour voir les exécutions. Le P&L des sorties partielles n’entre
          dans les statistiques clôturées qu’à la clôture complète.
        </p>
      </Panel>
    </JournalShell>
  );
}
