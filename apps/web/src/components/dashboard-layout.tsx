"use client";

import { type CSSProperties, type ReactNode } from "react";
import { balancedDashboardSpans, type DashboardCardSize } from "@/lib/dashboard-layout";

interface Widget {
  id: string;
  label: string;
  size: DashboardCardSize;
  layoutGroup: "summary" | "visuals" | "detail" | "secondary" | "full";
  content: ReactNode;
}

/**
 * Stable hosted dashboard layout.
 * The upstream draggable/customizable layout is intentionally bypassed here:
 * the trading journal needs a deterministic renderer that cannot fail during
 * browser-only drag/localStorage initialization.
 */
export function DashboardLayout({ widgets }: { widgets: Widget[] }) {
  const compactSpans = balancedDashboardSpans(widgets, 2, {
    small: 1, medium: 2, wide: 2, full: 2,
  });
  const tabletSpans = balancedDashboardSpans(widgets, 6, {
    small: 2, medium: 2, wide: 4, full: 6,
  });
  const desktopSpans = balancedDashboardSpans(widgets, 15, {
    small: 3, medium: 5, wide: 10, full: 15,
  });

  return (
    <div className="space-y-3 p-4">
      <div className="dashboard-grid-stage" data-dashboard-stage>
        <div className="dashboard-grid relative grid gap-3" data-dashboard-grid>
          {widgets.map((widget) => (
            <section
              key={widget.id}
              data-dashboard-card={widget.id}
              data-card-size={widget.size}
              aria-label={widget.label}
              className="dashboard-grid-card relative flex min-w-0 flex-col rounded-xl"
              style={{
                "--dashboard-span-compact": compactSpans[widget.id]!,
                "--dashboard-span-tablet": tabletSpans[widget.id]!,
                "--dashboard-span-desktop": desktopSpans[widget.id]!,
              } as CSSProperties}
            >
              <div data-dashboard-surface className="dashboard-card-surface relative flex h-full min-w-0 flex-col">
                <div className="min-w-0 flex-1">{widget.content}</div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
