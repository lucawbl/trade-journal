export function DashboardTabs({ active }: { active: "overview" | "bilan" }) {
  return (
    <nav
      aria-label="Vues du dashboard"
      className="flex w-fit gap-1 rounded-lg border bg-card p-1 text-sm"
    >
      {[
        { key: "overview", href: "/", label: "Vue d’ensemble" },
        { key: "bilan", href: "/?view=bilan", label: "Bilan" },
      ].map((tab) => (
        <a
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={`rounded-md px-4 py-2 ${active === tab.key ? "bg-secondary font-medium text-brand" : "text-muted-foreground hover:text-foreground"}`}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}
