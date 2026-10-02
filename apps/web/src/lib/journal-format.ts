/** Normalize punctuation so Node and browser ICU versions render identical text. */
export const number = (value: number | null | undefined, digits = 2) =>
  value != null && Number.isFinite(value)
    ? new Intl.NumberFormat("fr-CH", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
        .formatToParts(value)
        .map((part) => (part.type === "group" ? "'" : part.type === "decimal" ? "," : part.value))
        .join("")
    : "—";

export function timestamp(value: string | null, timeZone: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (key: string) => parts.find((item) => item.type === key)?.value ?? "";
  return `${part("day")}.${part("month")}.${part("year")} · ${part("hour")}:${part("minute")}`;
}

/** Keep small token prices visible without scientific notation. */
export const priceNumber = (value: number | null | undefined) =>
  number(value, value != null && Math.abs(value) > 0 && Math.abs(value) < 0.001 ? 10 : 5);
