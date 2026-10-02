/** Bounded month parsing avoids invalid Date values and preserves year boundaries. */
export function journalMonth(value: string | undefined, today: string) {
  const valid = (v: string) =>
    /^\d{4}-(0[1-9]|1[0-2])$/.test(v) &&
    Number(v.slice(0, 4)) >= 1900 &&
    Number(v.slice(0, 4)) <= 2100;
  const key = value && valid(value) ? value : today.slice(0, 7);
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const date = new Date(Date.UTC(year, month - 1, 1));
  const shift = (delta: number) =>
    new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 7);
  return {
    key,
    year,
    month,
    previous: shift(-1),
    next: shift(1),
    label: new Intl.DateTimeFormat("fr-CH", {
      timeZone: "UTC",
      year: "numeric",
      month: "long",
    }).format(date),
  };
}
