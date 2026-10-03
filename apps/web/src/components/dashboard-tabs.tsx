"use client";

import { useEffect, useRef } from "react";

export function DashboardTabs({
  active,
}: {
  active: "overview" | "bilan" | "accounts" | "calendar";
}) {
  const navigation = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navigation.current;
    if (!nav) return;
    const revealActive = () => {
      const tab = nav.querySelector<HTMLAnchorElement>('a[aria-current="page"]');
      if (!tab) return;
      const navBounds = nav.getBoundingClientRect();
      const tabBounds = tab.getBoundingClientRect();
      const left = navBounds.left + nav.clientLeft + 4;
      const right = navBounds.left + nav.clientLeft + nav.clientWidth - 4;
      if (tabBounds.left < left) nav.scrollLeft -= left - tabBounds.left;
      else if (tabBounds.right > right) nav.scrollLeft += tabBounds.right - right;
    };
    revealActive();
    const observer = new ResizeObserver(revealActive);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [active]);

  return (
    <nav
      ref={navigation}
      aria-label="Vues du dashboard"
      className="flex w-full min-w-0 max-w-full gap-1 overflow-x-auto rounded-lg border bg-card p-1 text-sm sm:w-fit"
    >
      {[
        { key: "overview", href: "/", label: "Vue d’ensemble" },
        { key: "bilan", href: "/?view=bilan", label: "Bilan" },
        { key: "accounts", href: "/?view=accounts", label: "Comptes" },
        { key: "calendar", href: "/?view=calendar", label: "Par jour" },
      ].map((tab) => (
        <a
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={`shrink-0 whitespace-nowrap rounded-md px-4 py-2 ${active === tab.key ? "bg-secondary font-medium text-brand" : "text-muted-foreground hover:text-foreground"}`}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}
