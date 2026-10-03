import type { ReactNode } from "react";
import { JournalRefresh } from "./journal-refresh";
import { JournalSidebarFrame } from "./journal-sidebar-frame";
import styles from "./dashboard-shell.module.css";

export function DashboardShell({
  children,
  title = "Dashboard",
  active = "/",
  wide = false,
  description,
}: {
  children: ReactNode;
  title?: string;
  active?: string;
  wide?: boolean;
  description?: string;
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
            <h1>{title}</h1>
            {description && <span>{description}</span>}
          </div>
        </div>
        <JournalRefresh hidden />
        {children}
      </div>
    </JournalSidebarFrame>
  );
}
