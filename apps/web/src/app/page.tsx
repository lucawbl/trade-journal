"use client";

import { Suspense } from "react";
import { FilterBar, useFilters } from "@/components/filter-bar";
import { useApi } from "@/lib/use-api";

interface StatsPayload {
  currencyScope?: { monetary?: boolean; currency?: string | null };
  openPositions?: unknown[];
  recentTrades?: unknown[];
}

export default function DashboardPage() {
  return <Suspense><Dashboard /></Suspense>;
}

function Dashboard() {
  const { query } = useFilters();
  const { data, loading, error } = useApi<StatsPayload>(`/api/stats?${query}`);

  return (
    <>
      <FilterBar title="Dashboard" />
      <main className="p-4">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">DOGE · Bybit Demo</h2>
          {loading && !data ? (
            <p className="mt-2 text-sm text-muted-foreground">Loading journal data…</p>
          ) : error ? (
            <p className="mt-2 text-sm text-destructive">API error: {error}</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Journal connection is active. Detailed analytics are temporarily disabled while the hosted dashboard is stabilised.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3 text-sm">Open positions: {data?.openPositions?.length ?? 0}</div>
                <div className="rounded-lg border p-3 text-sm">Recent closed trades: {data?.recentTrades?.length ?? 0}</div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
