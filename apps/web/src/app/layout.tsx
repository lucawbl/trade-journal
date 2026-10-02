import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trade Journal",
  description: "DOGE Bybit Demo trade journal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
