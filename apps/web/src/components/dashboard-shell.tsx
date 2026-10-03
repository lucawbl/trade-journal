import type { ReactNode } from "react";
import {
  LayoutDashboard,
  ChartNoAxesCombined,
  History,
  Wallet,
  ChartColumn,
  CalendarDays,
} from "lucide-react";
import { JournalRefresh } from "./journal-refresh";
import styles from "./dashboard-shell.module.css";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/market", label: "Marché", icon: ChartNoAxesCombined },
  { href: "/trades", label: "Historique", icon: History },
  { href: "/accounts", label: "Comptes", icon: Wallet },
  { href: "/reports", label: "Bilan", icon: ChartColumn },
  { href: "/calendar", label: "Par jour", icon: CalendarDays },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <main className={styles.shell}>
      <a href="#journal-content" className="sr-only focus:not-sr-only focus:p-4">
        Aller au contenu
      </a>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span>TJ</span>
          <div>
            Trade Journal<small>Tableau de bord</small>
          </div>
        </div>
        <nav aria-label="Navigation principale">
          {navigation.map(({ href, label, icon: Icon }) => (
            <a key={href} href={href} aria-current={href === "/" ? "page" : undefined}>
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className={styles.sidebarNote}>
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-300" /> Comptes démo
          <small>Ton journal, tes performances.</small>
        </div>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.header}>
          <span>Journal des bots / Vue d’ensemble</span>
          <span className={styles.badge}>Environnement démo</span>
        </header>
        <div id="journal-content" className={styles.content}>
          <div className={styles.heading}>
            <div>
              <p>VUE D’ENSEMBLE</p>
              <h1>Dashboard</h1>
              <span>Les résultats de tes bots, en un coup d’œil.</span>
            </div>
          </div>
          <JournalRefresh />
          {children}
          <footer className="border-t pt-4 text-xs text-muted-foreground">
            Résultats après frais enregistrés. Les gains clôturés et les sorties partielles restent
            distingués.
          </footer>
        </div>
      </div>
    </main>
  );
}
