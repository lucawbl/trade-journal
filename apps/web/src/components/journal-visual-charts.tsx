import type { ReactNode } from "react";
import type { EquityPoint } from "@luxalgo/journal-core";
import { number } from "@/lib/journal-format";

export function JournalVisualMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="tnum mt-2 break-words text-xl font-semibold">{value}</div>
    </div>
  );
}

export function JournalVisualDonut({
  segments,
  value,
  label,
}: {
  segments: { label: string; value: number; color: string }[];
  value: string;
  label: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let offset = 0;
  const circumference = Math.PI * 96;
  return (
    <figure className="flex min-w-0 flex-wrap items-center justify-center gap-5 py-2">
      <div className="relative h-32 w-32 shrink-0">
        <svg
          viewBox="0 0 128 128"
          className="h-full w-full -rotate-90"
          role="img"
          aria-label={`${label} : ${total ? segments.map((segment) => `${segment.label} ${number(segment.value, 0)}`).join(", ") : "aucune donnée"}`}
        >
          <circle cx="64" cy="64" r="48" fill="none" stroke="var(--secondary)" strokeWidth="13" />
          {segments.map((segment) => {
            const length = total ? (segment.value / total) * circumference : 0;
            const start = offset;
            offset += length;
            return (
              <circle
                key={segment.label}
                cx="64"
                cy="64"
                r="48"
                fill="none"
                stroke={segment.color}
                strokeWidth="13"
                strokeDasharray={`${length} ${circumference}`}
                strokeDashoffset={-start}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <strong className="tnum text-xl">{value}</strong>
          <span className="mt-1 text-[10px] text-muted-foreground">{label}</span>
        </div>
      </div>
      <figcaption className="min-w-0 space-y-2 text-xs">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: segment.color }} />
            <span className="text-muted-foreground">{segment.label}</span>
            <strong className="tnum ml-auto pl-3">{number(segment.value, 0)}</strong>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}

export function JournalVisualBars({
  items,
  currency = "",
  signed = true,
}: {
  items: { label: string; value: number; note?: string; href?: string }[];
  currency?: string;
  signed?: boolean;
}) {
  if (!items.length)
    return <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée.</p>;
  const maximum = Math.max(...items.map((item) => Math.abs(item.value)), 1e-10);
  const centered = signed || items.some((item) => item.value < 0);
  return (
    <figure className="space-y-4">
      {items.map((item) => {
        const width = (Math.abs(item.value) / maximum) * (centered ? 50 : 100);
        const content = (
          <>
            <div className="mb-1.5 flex min-w-0 items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate" title={item.label}>
                {item.label}
              </span>
              <span
                className={`tnum shrink-0 ${signed ? (item.value < 0 ? "text-loss" : item.value > 0 ? "text-profit" : "text-muted-foreground") : "text-foreground"}`}
              >
                {signed && item.value > 0 ? "+" : ""}
                {number(item.value)}
                {currency ? ` ${currency}` : ""}
              </span>
            </div>
            <div
              className="relative h-3 overflow-hidden rounded-sm bg-secondary/60"
              aria-hidden="true"
            >
              {centered && (
                <span className="absolute inset-y-0 left-1/2 w-px bg-muted-foreground/40" />
              )}
              <span
                className="absolute inset-y-0 rounded-sm"
                style={{
                  width: `${width}%`,
                  left: `${centered ? (item.value < 0 ? 50 - width : 50) : 0}%`,
                  background: signed
                    ? item.value < 0
                      ? "var(--loss)"
                      : "var(--profit)"
                    : "var(--brand)",
                }}
              />
            </div>
            {item.note && <p className="mt-1 text-[10px] text-muted-foreground">{item.note}</p>}
          </>
        );
        return item.href ? (
          <a
            key={item.label}
            href={item.href}
            className="block rounded-sm focus-visible:outline-2 focus-visible:outline-brand"
          >
            {content}
          </a>
        ) : (
          <div key={item.label}>{content}</div>
        );
      })}
    </figure>
  );
}

export function JournalVisualCurve({
  points,
  currency,
}: {
  points: EquityPoint[];
  currency: string;
}) {
  if (!points.length)
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
        Aucune clôture.
      </div>
    );
  const values = [0, ...points.map((point) => point.cumNetPnl)];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const x = (index: number) => 12 + (index / (values.length - 1)) * 576;
  const y = (value: number) => 143 - ((value - minimum) / range) * 125;
  const coordinates = values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const end = values.at(-1)!;
  return (
    <figure>
      <svg
        viewBox="0 0 600 160"
        className="h-40 w-full"
        role="img"
        aria-label={`Résultat clôturé cumulé : ${number(end)} ${currency}`}
      >
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            x1="12"
            x2="588"
            y1={y(minimum + fraction * range)}
            y2={y(minimum + fraction * range)}
            stroke="var(--border)"
            strokeDasharray="3 4"
          />
        ))}
        <line x1="12" x2="588" y1={y(0)} y2={y(0)} stroke="var(--baseline)" strokeDasharray="4 4" />
        <polygon
          points={`12,${y(0)} ${coordinates} 588,${y(0)}`}
          fill="var(--brand)"
          opacity="0.09"
        />
        <polyline
          points={coordinates}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {points.map((point, index) =>
          index % Math.max(1, Math.ceil(points.length / 35)) === 0 ||
          index === points.length - 1 ? (
            <circle
              key={`${point.t}-${index}`}
              cx={x(index + 1)}
              cy={y(point.cumNetPnl)}
              r="3"
              fill="var(--brand)"
            >
              <title>{`${point.t} : ${number(point.cumNetPnl)} ${currency}`}</title>
            </circle>
          ) : null,
        )}
      </svg>
      <figcaption className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
        <span>0 {currency}</span>
        <span className={`tnum ${end < 0 ? "text-loss" : end > 0 ? "text-profit" : ""}`}>
          {end > 0 ? "+" : ""}
          {number(end)} {currency}
        </span>
      </figcaption>
    </figure>
  );
}

export function JournalVisualColumns({
  items,
  currency = "",
  monetary = true,
}: {
  items: { label: string; axisLabel?: string; value: number; href?: string; trades?: number }[];
  currency?: string;
  monetary?: boolean;
}) {
  if (!items.length || items.every((item) => item.trades === 0 && item.value === 0))
    return <p className="py-8 text-center text-sm text-muted-foreground">Aucune clôture.</p>;
  const maximum = Math.max(...items.map((item) => Math.abs(item.value)), 1e-10);
  const every = Math.max(1, Math.ceil(items.length / 7));
  return (
    <figure>
      <div
        className="relative grid h-44 gap-1"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-muted-foreground/40" />
        {items.map((item) => {
          const height = (Math.abs(item.value) / maximum) * 43;
          const caption = `${item.label} : ${number(item.value)}${currency ? ` ${currency}` : ""}${item.trades === undefined ? "" : ` · ${item.trades} clôtures`}`;
          const bar = (
            <span
              className="absolute inset-x-0 rounded-sm"
              style={{
                height: `${height}%`,
                top: `${item.value < 0 ? 50 : 50 - height}%`,
                maxWidth: 32,
                marginInline: "auto",
                background: monetary
                  ? item.value < 0
                    ? "var(--loss)"
                    : "var(--profit)"
                  : "var(--brand)",
              }}
            />
          );
          return item.href ? (
            <a
              key={item.label}
              href={item.href}
              aria-label={caption}
              title={caption}
              className="relative min-w-0 rounded-sm focus-visible:outline-2 focus-visible:outline-brand"
            >
              {bar}
            </a>
          ) : (
            <div
              key={item.label}
              role="img"
              aria-label={caption}
              title={caption}
              className="relative min-w-0"
            >
              {bar}
            </div>
          );
        })}
      </div>
      <figcaption className="mt-2 flex justify-between gap-1 text-[9px] text-muted-foreground">
        {items
          .filter((_, index) => index % every === 0 || index === items.length - 1)
          .map((item) => (
            <span key={item.label}>
              {item.axisLabel ??
                (item.label.includes("-")
                  ? item.label.slice(5).split("-").reverse().join(".")
                  : item.label)}
            </span>
          ))}
      </figcaption>
      <p className="mt-3 text-right text-[10px] text-muted-foreground">{currency || "Clôtures"}</p>
    </figure>
  );
}
