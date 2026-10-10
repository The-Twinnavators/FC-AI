/**
 * The one date helper the reference scheduler needs. EventList has imported it since the first
 * commit, but it was never written, so the reference app has never typechecked: the browser
 * verification test fails at its first required check before it reaches anything it is testing.
 */

/** "2026-06-12", "14:30" -> "Fri 12 Jun 2026, 2:30 PM". Falls back to the raw values if either is unparsable. */
export function formatDisplayDate(date: string, time: string): string {
  const when = new Date(`${date}T${time || "00:00"}`);
  if (Number.isNaN(when.getTime())) return [date, time].filter(Boolean).join(" ");
  const day = when.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return time ? `${day}, ${when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : day;
}
