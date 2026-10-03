"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  ChartNoAxesCombined,
  History,
  Wallet,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import styles from "./dashboard-shell.module.css";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/market", label: "Marché", icon: ChartNoAxesCombined },
  { href: "/trades", label: "Historique", icon: History },
  { href: "/accounts", label: "Comptes", icon: Wallet },
  { href: "/calendar", label: "Par jour", icon: CalendarDays },
];

export function JournalSidebarFrame({
  children,
  active,
  terminal = false,
}: {
  children: ReactNode;
  active: string;
  terminal?: boolean;
}) {
  const [hidden, setHidden] = useState<boolean | null>(null);
  useEffect(() => {
    let initial = window.matchMedia("(max-width: 760px)").matches;
    try {
      const saved = localStorage.getItem("journal-sidebar-hidden");
      if (saved != null) initial = saved === "true";
    } catch {}
    setHidden(initial);
  }, []);
  const change = (value: boolean) => {
    setHidden(value);
    try {
      localStorage.setItem("journal-sidebar-hidden", String(value));
    } catch {}
  };
  return (
    <main
      className={styles.shell}
      data-terminal={terminal}
      data-sidebar-hidden={hidden === true}
      data-sidebar-ready={hidden != null}
    >
      <a
        href={terminal ? "#market-chart" : "#journal-content"}
        className="sr-only focus:not-sr-only focus:p-4"
      >
        Aller au contenu
      </a>
      <button
        className={styles.toggle}
        type="button"
        onClick={() => change(!hidden)}
        aria-label={hidden ? "Afficher les onglets" : "Masquer les onglets"}
        aria-expanded={!hidden}
        aria-controls="journal-sidebar"
      >
        {hidden ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}
      </button>
      <button
        className={styles.backdrop}
        type="button"
        aria-label="Fermer le menu"
        onClick={() => change(true)}
        tabIndex={hidden ? -1 : 0}
      />
      <aside id="journal-sidebar" className={styles.sidebar} inert={hidden === true}>
        <div className={styles.brand}>
          <span>TJ</span>
          <div>
            Trade Journal<small>Journal des bots</small>
          </div>
        </div>
        <nav aria-label="Navigation principale">
          {navigation.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              onClick={() => {
                if (window.matchMedia("(max-width: 760px)").matches) change(true);
              }}
              aria-current={href === active ? "page" : undefined}
            >
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
        {!terminal && (
          <header className={styles.header}>
            <span>
              Journal des bots /{" "}
              {navigation.find((item) => item.href === active)?.label ?? "Vue d’ensemble"}
            </span>
            <span className={styles.badge}>Environnement démo</span>
          </header>
        )}
        {children}
      </div>
    </main>
  );
}
