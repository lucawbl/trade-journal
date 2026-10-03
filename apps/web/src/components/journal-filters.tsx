import type { AnalysisFilters } from "@luxalgo/journal-core";
import type { JournalView } from "@/server/journal-view";

export function JournalFilters({
  action,
  accounts,
  filters,
  month,
  closedOnly = false,
  extraFields = {},
}: {
  action: string;
  accounts: JournalView["accounts"];
  filters: AnalysisFilters;
  month?: string;
  closedOnly?: boolean;
  extraFields?: Record<string, string>;
}) {
  const inputClass = "mt-1 min-w-0 w-full rounded-md border bg-background px-3 py-2 text-sm";
  return (
    <form action={action} method="get" className="grid grid-cols-2 items-end gap-3 lg:grid-cols-4">
      {Object.entries(extraFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {month && <input type="hidden" name="month" value={month} />}
      {closedOnly && <input type="hidden" name="status" value="closed" />}
      <label className="min-w-0 text-xs text-muted-foreground">
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
      <label className="min-w-0 text-xs text-muted-foreground">
        Symbole
        <input
          name="symbol"
          list="journal-symbols"
          defaultValue={filters.symbol ?? ""}
          placeholder="DOGEUSDT"
          className={inputClass}
        />
      </label>
      <datalist id="journal-symbols">
        {["DOGEUSDT", "PEPEUSDT", "BTCUSDT"].map((symbol) => (
          <option key={symbol} value={symbol} />
        ))}
      </datalist>
      {!closedOnly && (
        <label className="min-w-0 text-xs text-muted-foreground">
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
      <label className="min-w-0 text-xs text-muted-foreground">
        Sens
        <select name="direction" defaultValue={filters.direction ?? ""} className={inputClass}>
          <option value="">Tous</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
      </label>
      {!month && (
        <>
          <label className="min-w-0 text-xs text-muted-foreground">
            Du
            <input
              type="date"
              name="from"
              defaultValue={filters.from ?? ""}
              className={inputClass}
            />
          </label>
          <label className="min-w-0 text-xs text-muted-foreground">
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
        href={
          month || Object.keys(extraFields).length
            ? `${action}?${new URLSearchParams({ ...extraFields, ...(month ? { month } : {}) })}`
            : action
        }
        className="px-3 py-2 text-center text-sm text-muted-foreground hover:text-foreground"
      >
        Réinitialiser
      </a>
    </form>
  );
}
