import { computeOverview, type AnalysisFilters } from "@luxalgo/journal-core";
import { asc } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { accounts, db } from "@/db";
import { AUTH_COOKIE, verifySession } from "./auth";
import { currencyProjection } from "./currency-conversion";
import { getCurrencyConversion, getTimeZone } from "./settings";
import { queryTrades } from "./trades-query";

/** Server pages must validate the session before reading private journal data. */
export async function requireJournalSession() {
  if (!verifySession((await cookies()).get(AUTH_COOKIE)?.value)) redirect("/login");
}

function snapshotEquity(value: string | null): number | null {
  try {
    const equity: unknown = value ? JSON.parse(value).equity : null;
    return typeof equity === "number" && Number.isFinite(equity) ? equity : null;
  } catch {
    return null;
  }
}

/** Read the existing journal; credentials and raw snapshots never reach the view. */
export function readJournalView(filters: AnalysisFilters = {}) {
  const timeZone = getTimeZone();
  const accountRows = db.select().from(accounts).orderBy(asc(accounts.createdAt)).all();
  const accountViews = accountRows.map((account) => ({
    id: account.id,
    name: account.name,
    broker: account.broker,
    kind: account.kind,
    currency: account.currency,
    initialBalance: account.initialBalance,
    lastSyncAt: account.lastSyncAt,
    archivedAt: account.archivedAt,
    equity: snapshotEquity(account.snapshotJson),
  }));
  const selected = filters.accounts
    ? accountViews.filter((account) => filters.accounts!.split(",").includes(account.id))
    : accountViews;
  const { rows, trades } = queryTrades(filters);
  const projection = currencyProjection(trades, selected, getCurrencyConversion());
  const overview = computeOverview(projection.scope.monetary ? projection.trades : trades, {
    timeZone,
    initialBalance: projection.initialBalance,
  });
  return {
    accounts: accountViews,
    rows: [...rows].sort(
      (a, b) => b.openedAt.localeCompare(a.openedAt) || a.key.localeCompare(b.key),
    ),
    trades,
    timeZone,
    overview,
    currencyScope: projection.scope,
    initialBalance: projection.initialBalance,
  };
}

export type JournalView = ReturnType<typeof readJournalView>;
