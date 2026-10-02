import type { ImportedExecution } from "@luxalgo/journal-importers";
import { eq } from "drizzle-orm";
import { accounts, db } from "@/db";
import { bad, handler, ok } from "@/server/api";
import { insertExecutions } from "@/server/executions";
import { nowIso } from "@/server/ids";

const ACCOUNT_ID = "bybit-demo-doge";

interface Body {
  executions?: ImportedExecution[];
}

export const POST = handler(
  async (request: Request) => {
    const secret = process.env.JOURNAL_INGEST_SECRET;
    if (!secret) return bad("Ingest disabled", 503);
    if (request.headers.get("authorization") !== `Bearer ${secret}`)
      return bad("Unauthorized", 401);

    const body = (await request.json()) as Body;
    if (!Array.isArray(body.executions) || body.executions.length === 0) {
      return bad("A non-empty executions array is required");
    }

    const existing = db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.id, ACCOUNT_ID))
      .get();
    if (!existing) {
      db.insert(accounts)
        .values({
          id: ACCOUNT_ID,
          name: "DOGE Bot · Bybit Demo",
          broker: "bybit-demo",
          kind: "manual",
          currency: "USDT",
          initialBalance: 50000,
          profitCalcMethod: "fifo",
          autoSync: false,
          createdAt: nowIso(),
        })
        .run();
    }

    const rows = body.executions.map((row) => ({
      ...row,
      symbol: String(row.symbol || "")
        .trim()
        .toUpperCase(),
      assetClass: row.assetClass ?? "crypto",
      fee: row.fee ?? 0,
    }));

    const result = insertExecutions(ACCOUNT_ID, rows, "sync", undefined, { preserveFees: true });
    // Retries with valid duplicate fills also confirm the bot is still reaching us.
    if (result.inserted + result.duplicates > 0) {
      db.update(accounts).set({ lastSyncAt: nowIso() }).where(eq(accounts.id, ACCOUNT_ID)).run();
    }
    return ok({ accountId: ACCOUNT_ID, ...result });
  },
  { public: true },
);
