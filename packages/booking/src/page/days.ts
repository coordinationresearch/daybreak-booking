import type { BookingLink } from "../types.js";

/** `date` moved by `days` calendar days. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const moved = new Date(Date.UTC(y!, m! - 1, d! + days));
  return moved.toISOString().slice(0, 10);
}

/** Whole calendar days from `a` to `b`. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** How many Days the page reads at once, a week. */
export const WEEK = 7;

/**
 * The `from` of the week `offset` weeks after the first bookable Day, or
 * null past the last one.
 */
export function weekStart(firstDay: string, lastDay: string, offset: number): string | null {
  if (offset < 0) return null;
  const from = addDays(firstDay, offset * WEEK);
  return from > lastDay ? null : from;
}

/** How many Days a phone shows at once, so each column stays wide enough to tap. */
export const PHONE_DAYS = 3;

/**
 * The narrowest a Day's column gets before the grid shows one Day fewer:
 * wide enough that the meeting's block holds its widest Day, "Wed, Nov 22nd".
 */
const DAY_MIN = 100;

/**
 * How many Days fit across the grid's width, 3 to 7: a phone shows 3, a
 * wider column more, a computer's full width the week. Beside the Days run
 * the time rails, the booker's alone when narrow and the host's too when wide.
 */
export function daysFitting(width: number, narrow: boolean): number {
  const rails = narrow ? 40 : 104;
  const fit = Math.floor((width - rails) / DAY_MIN);
  return Math.max(PHONE_DAYS, Math.min(WEEK, fit));
}

/** The `from` of the Days `offset` Days after the first bookable Day, or null outside the bookable Days. */
export function windowStart(firstDay: string, lastDay: string, offset: number): string | null {
  if (offset < 0) return null;
  const from = addDays(firstDay, offset);
  return from > lastDay ? null : from;
}

/**
 * The day nav's words for the Days shown, `offset` Days after the first
 * bookable one. The Days carry their own dates, so this says how far out
 * they are: a week is "This week", "Next week", then "In 3 weeks"; a
 * phone's few Days are "Next 3 days", then "In 6 days", then weeks.
 */
export function stepLabel(offset: number, count: number): string {
  const weeks = Math.round(offset / WEEK);
  const inWeeks = weeks === 1 ? "Next week" : `In ${weeks} weeks`;
  if (count >= WEEK) return weeks === 0 ? "This week" : inWeeks;
  if (offset === 0) return `Next ${count} days`;
  if (offset === 1) return "From tomorrow";
  return offset < 2 * WEEK ? `In ${offset} days` : inWeeks;
}

/** A length's numbers and units: under 100 minutes in minutes ("90m"), then hours ("2h 30m"). */
export function lengthParts(minutes: number): { value: number; unit: "h" | "m" }[] {
  if (minutes < 100) return [{ value: minutes, unit: "m" }];
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [
    ...(hours > 0 ? [{ value: hours, unit: "h" as const }] : []),
    ...(rest > 0 || hours === 0 ? [{ value: rest, unit: "m" as const }] : []),
  ];
}

/** "15m", "90m", or "2h 30m". */
export function lengthLabel(minutes: number): string {
  return lengthParts(minutes)
    .map(({ value, unit }) => `${value}${unit}`)
    .join(" ");
}

/** "15 minutes" or "2 hours 30 minutes", for screen readers. */
export function lengthWords(minutes: number): string {
  return lengthParts(minutes)
    .map(({ value, unit }) => (unit === "h" ? `${value} hour${value === 1 ? "" : "s"}` : `${value} minute${value === 1 ? "" : "s"}`))
    .join(" ");
}

/** "Google Meet", "Video call", or the place, for the call line. */
export function callLabel(call: BookingLink["call"]): string {
  switch (call.kind) {
    case "meet":
      return "Google Meet";
    case "link":
      return "Video call";
    case "place":
      return call.location ?? "In person";
  }
}
