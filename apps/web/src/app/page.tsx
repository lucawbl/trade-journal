export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <main style={{ minHeight: "100vh", padding: "32px", background: "#0a0a0a", color: "#fafafa", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 700 }}>Trade Journal</h1>
      <p style={{ marginTop: "12px", opacity: 0.75 }}>DOGE · Bybit Demo</p>
      <div style={{ marginTop: "24px", padding: "18px", border: "1px solid #333", borderRadius: "12px" }}>
        Journal server is online. Browser client runtime has been bypassed for diagnostics.
      </div>
    </main>
  );
}
