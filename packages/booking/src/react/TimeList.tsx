"use client";

import type { BookingDay } from "../types.js";
import { startsIn } from "../page/slots.js";
import {
  clockLabel,
  dateLabel,
  sameClock,
  weekdayLabel,
  zonedParts,
} from "../page/zones.js";
import { SunIcon } from "./icons.js";

const cn = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

type Props = {
  days: BookingDay[];
  activeDay: string | null;
  hostZone: string;
  bookerZone: string;
  host: string;
  length: number;
  selection: number | null;
  suggestions: number[];
  onDay: (day: string) => void;
  onSelect: (start: number) => void;
};

const PARTS = [
  { name: "Morning", until: 12 },
  { name: "Afternoon", until: 17 },
  { name: "Evening", until: 24 },
];

/**
 * The phone's picker: one Day at a time, its open starts as a list of
 * buttons, grouped by the booker's part of the day. Each shows the
 * booker's time and, when the clocks differ, the host's under it.
 */
export function TimeList({
  days,
  activeDay,
  hostZone,
  bookerZone,
  host,
  length,
  selection,
  suggestions,
  onDay,
  onSelect,
}: Props) {
  const openDays = days.filter((d) => startsIn(d.open, length).length > 0);
  const day = openDays.find((d) => d.day === activeDay) ?? openDays[0];
  if (!day) {
    return (
      <p className="dbk-empty">
        Nothing open this week at this length.
      </p>
    );
  }
  const starts = startsIn(day.open, length);
  const groups = PARTS.map((part, i) => ({
    name: part.name,
    starts: starts.filter((start) => {
      const hour = zonedParts(start, bookerZone).hour;
      return hour < part.until && hour >= (PARTS[i - 1]?.until ?? 0);
    }),
  })).filter((group) => group.starts.length > 0);

  return (
    <div className="dbk-stack-lg">
      <div
        role="group"
        aria-label="Days"
        className="dbk-day-chips"
      >
        {openDays.map((d) => {
          const best = suggestions.some((s) =>
            d.open.some((o) => o.start <= s && s < o.end),
          );
          return (
            <button
              key={d.day}
              type="button"
              aria-pressed={d.day === day.day}
              onClick={() => onDay(d.day)}
              className={cn("dbk-btn dbk-day-chip", d.day === day.day ? "dbk-btn-solid" : "dbk-btn-outline")}
            >
              <span className="dbk-chip-weekday">
                {weekdayLabel(d.day)}
              </span>
              <span className="dbk-row-tight">
                {dateLabel(d.day)}
                {best && (
                  <SunIcon size={12} className="dbk-sun" label="Has a best time" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {groups.map((group) => (
        <section key={group.name} aria-label={group.name}>
          <h3 className="dbk-caps dbk-group-title">
            {group.name}
          </h3>
          <ul className="dbk-times">
            {group.starts.map((start) => {
              const best = suggestions.includes(start);
              const both = !sameClock(start, hostZone, bookerZone);
              return (
                <li key={start}>
                  <button
                    type="button"
                    aria-pressed={selection === start}
                    aria-label={`${clockLabel(start, bookerZone)} your time${
                      both ? `, ${clockLabel(start, hostZone)} for ${host}` : ""
                    }${best ? ", a best time" : ""}`}
                    data-best={best && selection !== start ? "" : undefined}
                    onClick={() => onSelect(start)}
                    className={cn(
                      "dbk-btn dbk-time-chip dbk-tabular",
                      selection === start ? "dbk-btn-solid" : "dbk-btn-outline",
                    )}
                  >
                    <span className="dbk-row-tight dbk-time-main">
                      {best && <SunIcon size={11} />}
                      {clockLabel(start, bookerZone)}
                    </span>
                    {both && (
                      <span className="dbk-time-host">
                        {clockLabel(start, hostZone)} {host}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
