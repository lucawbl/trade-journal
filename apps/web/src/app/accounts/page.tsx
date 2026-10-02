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

export default async function AccountsPage() {
  const data=await api("/api/accounts");
  const rows=data?.accounts ?? [];
  return <main className="min-h-screen bg-background p-6 text-foreground"><div className="mx-auto max-w-6xl">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
      <div><h1 className="text-2xl font-semibold">Accounts</h1><p className="text-sm text-muted-foreground">Bybit Demo · server-rendered</p></div>
      <nav className="flex gap-4 text-sm"><Link href="/">Dashboard</Link><Link href="/trades">Trades</Link><Link href="/accounts">Accounts</Link></nav>
    </header>
    <section className="grid gap-4 md:grid-cols-2">
      {rows.length?rows.map((a:any)=><article key={a.id} className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-semibold">{a.name}</h2><p className="text-sm text-muted-foreground">{a.broker || "Broker"} · {a.kind}</p></div><span className="text-xs text-muted-foreground">{a.connected?"Connected":"Stored"}</span></div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-muted-foreground">Currency</p><p>{a.currency}</p></div>
          <div><p className="text-xs text-muted-foreground">Initial balance</p><p>{n(a.initialBalance)} {a.currency}</p></div>
          <div><p className="text-xs text-muted-foreground">Broker equity</p><p>{a.snapshot?n(a.snapshot.equity)+" "+a.currency:"—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Open positions</p><p>{a.snapshot?.positions?.length ?? 0}</p></div>
        </div>
        {a.lastSyncAt&&<p className="mt-4 text-xs text-muted-foreground">Last sync: {a.lastSyncAt.slice(0,16).replace("T"," ")}</p>}
      </article>):<p className="text-sm text-muted-foreground">No account found.</p>}
    </section>
  </div></main>;
}
