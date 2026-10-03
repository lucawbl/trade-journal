import type { ReactNode } from "react";
import { JournalRefresh } from "./journal-refresh";
import { JournalSidebarFrame } from "./journal-sidebar-frame";
import styles from "./dashboard-shell.module.css";

export function DashboardShell({
  children,
  title = "Dashboard",
  active = "/",
  wide = false,
}: {
  children: ReactNode;
  title?: string;
  active?: string;
  wide?: boolean;
}) {
  return (
    <JournalSidebarFrame active={active}>
      <div
        id="journal-content"
        className={styles.content}
        style={wide ? { maxWidth: 1920 } : undefined}
      >
        <div className={styles.heading}>
          <div>
            <p>{active === "/trades" ? "ANALYSE DES TRADES" : "JOURNAL DES BOTS"}</p>
            <h1>{title}</h1>
            <span>
              {active === "/trades"
                ? "Comprends tes résultats et retrouve chaque trade."
                : "Les résultats de tes bots, en un coup d’œil."}
            </span>
          </div>
        </div>
        {active !== "/trades" && <JournalRefresh />}
        {children}
        <footer className="border-t pt-4 text-xs text-muted-foreground">
          Résultats après frais enregistrés. Les gains clôturés et les sorties partielles restent
          distingués.
        </footer>
      </div>
    </JournalSidebarFrame>
  );
}
