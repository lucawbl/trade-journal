import Link from "next/link";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-2xl font-semibold">Trade Journal</h1>
            <p className="mt-1 text-sm text-muted-foreground">DOGE · Bybit Demo</p>
          </div>
          <nav className="flex gap-4 text-sm">
            <Link href="/">Dashboard</Link>
            <Link href="/trades">Trades</Link>
            <Link href="/accounts">Accounts</Link>
          </nav>
        </header>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-medium">Journal connecté</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            La synchronisation du bot reste active. Reconstruction progressive de l’interface.
          </p>
        </section>
      </div>
    </main>
  );
}
