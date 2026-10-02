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

export default async function TradesPage() {
  const data=await api("/api/trades?view=list");
  const rows=data?.trades ?? [];
  const m=data?.metrics;
  return <main className="min-h-screen bg-background p-6 text-foreground"><div className="mx-auto max-w-6xl">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
      <div><h1 className="text-2xl font-semibold">Trades</h1><p className="text-sm text-muted-foreground">DOGE · Bybit Demo · server-rendered</p></div>
      <nav className="flex gap-4 text-sm"><Link href="/">Dashboard</Link><Link href="/trades">Trades</Link><Link href="/accounts">Accounts</Link></nav>
    </header>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Trades</p><p className="mt-2 text-2xl font-semibold">{m?.totalTrades ?? rows.length}</p></div>
      <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Net P&L</p><p className="mt-2 text-2xl font-semibold">{n(m?.netPnl)} USDT</p></div>
      <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Win rate</p><p className="mt-2 text-2xl font-semibold">{typeof m?.winRate==="number"?n(m.winRate*100,1)+"%":"—"}</p></div>
      <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Closed</p><p className="mt-2 text-2xl font-semibold">{m?.closedTrades ?? "—"}</p></div>
    </section>
    <section className="mt-4 rounded-xl border bg-card p-4"><h2 className="font-semibold">Trade history</h2>
      {rows.length?<div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-muted-foreground"><tr><th className="py-2">Symbol</th><th>Direction</th><th>Status</th><th>Quantity</th><th>Entry</th><th>Exit</th><th>Net P&L</th></tr></thead><tbody>{rows.map((t:any)=><tr key={t.key} className="border-t"><td className="py-2">{t.symbol}</td><td>{t.direction}</td><td>{t.status}</td><td>{n(t.quantity,4)}</td><td>{n(t.avgEntry,5)}</td><td>{n(t.avgExit,5)}</td><td>{n(t.netPnl)} USDT</td></tr>)}</tbody></table></div>:<p className="mt-3 text-sm text-muted-foreground">No reconstructed trade yet. An open DOGE position will appear after its exit is reconstructed.</p>}
    </section>
  </div></main>;
}
