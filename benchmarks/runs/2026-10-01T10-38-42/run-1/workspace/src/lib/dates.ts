/** Formats an ISO date (YYYY-MM-DD) and optional time (HH:MM) for display, e.g. "Tue, Oct 14 · 09:30". */
export function formatDisplayDate(date: string, time?: string, locale = "en-US"): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const value = new Date(Date.UTC(y, m - 1, d));
  const label = new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(value);
  return time ? `${label} · ${time}` : label;
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
