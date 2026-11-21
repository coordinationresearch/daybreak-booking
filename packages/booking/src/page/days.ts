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

/** "15 min", "1 hr", or "1 hr 30". */
export function lengthLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest}`;
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
