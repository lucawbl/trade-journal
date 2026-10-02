import type { AnalysisFilters } from "@luxalgo/journal-core";
import type { JournalView } from "@/server/journal-view";

export function JournalFilters({
  action,
  accounts,
  filters,
  month,
  closedOnly = false,
}: {
  action: string;
  accounts: JournalView["accounts"];
  filters: AnalysisFilters;
  month?: string;
  closedOnly?: boolean;
}) {
  const inputClass = "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm";
  return (
    <form
      action={action}
      method="get"
      className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      {month && <input type="hidden" name="month" value={month} />}
      {closedOnly && <input type="hidden" name="status" value="closed" />}
      <label className="text-xs text-muted-foreground">
        Compte
        <select name="accounts" defaultValue={filters.accounts ?? ""} className={inputClass}>
          <option value="">Tous les comptes</option>
          {accounts.map((a) => (
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
          defaultValue={filters.symbol ?? ""}
          placeholder="DOGEUSDT"
          className={inputClass}
        />
      </label>
      {!closedOnly && (
        <label className="text-xs text-muted-foreground">
          Statut
          <select name="status" defaultValue={filters.status ?? ""} className={inputClass}>
            {[
              ["", "Tous les statuts"],
              ["open", "Ouverts / sorties partielles"],
              ["closed", "Clôturés"],
              ["win", "Gagnants"],
              ["loss", "Perdants"],
              ["breakeven", "Équilibre"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="text-xs text-muted-foreground">
        Sens
        <select name="direction" defaultValue={filters.direction ?? ""} className={inputClass}>
          <option value="">Tous</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
      </label>
      {!month && (
        <>
          <label className="text-xs text-muted-foreground">
            Du
            <input
              type="date"
              name="from"
              defaultValue={filters.from ?? ""}
              className={inputClass}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Au
            <input type="date" name="to" defaultValue={filters.to ?? ""} className={inputClass} />
          </label>
        </>
      )}
      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Appliquer
      </button>
      <a
        href={month ? `${action}?month=${month}` : action}
        className="px-3 py-2 text-center text-sm text-muted-foreground hover:text-foreground"
      >
        Réinitialiser
      </a>
    </form>
  );
}
