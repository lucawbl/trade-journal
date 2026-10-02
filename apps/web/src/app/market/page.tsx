import { JournalShell } from "@/components/journal-view";
import { LiveMarketChart } from "@/components/live-market-chart";
import { requireJournalSession } from "@/server/journal-view";
import { getTimeZone } from "@/server/settings";
import { isLiveSymbol } from "@/lib/live-market";
import { isResolution } from "@/lib/market-data";
export const dynamic = "force-dynamic";
export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireJournalSession();
  const params = await searchParams;
  return (
    <JournalShell title="Marché en direct" active="market" wide>
      <section
        aria-label="Grand graphique des cryptomonnaies"
        className="min-w-0 rounded-xl border bg-card p-3 sm:p-5"
      >
        <LiveMarketChart
          initialSymbol={isLiveSymbol(params.symbol) ? params.symbol : "DOGEUSDT"}
          initialResolution={isResolution(params.resolution) ? params.resolution : "1m"}
          timeZone={getTimeZone()}
          large
        />
      </section>
    </JournalShell>
  );
}
