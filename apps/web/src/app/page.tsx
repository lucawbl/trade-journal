import Link from "next/link";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

async function api(path: string) {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (!host) return null;
  try {
    const r = await fetch(`${proto}://${host}${path}`, { cache: "no-store" });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
const n=(v:unknown,d=2)=>typeof v==="number"&&Number.isFinite(v)?v.toFixed(d):"—";

export default async function DashboardPage() {
  const [stats, accounts, trades] = await Promise.all([
    api("/api/stats"), api("/api/accounts"), api("/api/trades?view=list"),
  ]);
  const m=stats?.metrics;
  const rows=trades?.trades ?? [];
  const acc=accounts?.accounts ?? [];
  return <main className="min-h-screen bg-background p-6 text-foreground"><div className="mx-auto max-w-6xl">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
      <div><h1 className="text-2xl font-semibold">Trade Journal</h1><p className="text-sm text-muted-foreground">DOGE · Bybit Demo</p></div>
      <nav className="flex gap-4 text-sm"><Link href="/">Dashboard</Link><Link href="/trades">Trades</Link><Link href="/accounts">Accounts</Link></nav>
    </header>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Trades</p><p className="mt-2 text-2xl font-semibold">{m?.totalTrades ?? rows.length}</p></div>
      <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Net P&L</p><p className="mt-2 text-2xl font-semibold">{n(m?.netPnl)} USDT</p></div>
      <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Win rate</p><p className="mt-2 text-2xl font-semibold">{typeof m?.winRate==="number"?n(m.winRate*100,1)+"%":"—"}</p></div>
      <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Open positions</p><p className="mt-2 text-2xl font-semibold">{stats?.openPositions?.length ?? 0}</p></div>
    </section>
    <section className="mt-4 rounded-xl border bg-card p-4"><h2 className="font-semibold">Account</h2>{acc.length?acc.map((a:any)=><div key={a.id} className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm"><span>{a.name}</span><span className="text-muted-foreground">{a.broker}</span><span>{a.currency}</span><span>Initial: {n(a.initialBalance)} {a.currency}</span></div>):<p className="mt-2 text-sm text-muted-foreground">No account found.</p>}</section>
    <section className="mt-4 rounded-xl border bg-card p-4"><h2 className="font-semibold">Recent trades</h2>{rows.length?<div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-muted-foreground"><tr><th className="py-2">Symbol</th><th>Direction</th><th>Status</th><th>Entry</th><th>Exit</th><th>Net P&L</th></tr></thead><tbody>{rows.slice(0,10).map((t:any)=><tr key={t.key} className="border-t"><td className="py-2">{t.symbol}</td><td>{t.direction}</td><td>{t.status}</td><td>{n(t.avgEntry,5)}</td><td>{n(t.avgExit,5)}</td><td>{n(t.netPnl)} USDT</td></tr>)}</tbody></table></div>:<p className="mt-2 text-sm text-muted-foreground">No reconstructed trade yet. The current DOGE position can remain open until its exit.</p>}</section>
  </div></main>;
}
