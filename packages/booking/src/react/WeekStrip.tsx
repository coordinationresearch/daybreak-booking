"use client";

import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef, useState } from "react";

import { MINUTE, bookableSpans, dragStart, nearestStart, startsIn, stepStart } from "../page/slots.js";
import { axisBounds, axisHours, minuteOnDay, momentOnDay } from "../page/strip.js";
import { dateLabel, hourLabel, sameClock, shortClock, weekdayLabel, zoneLabel, zonedDate } from "../page/zones.js";
import type { BookingDay } from "../types.js";
import { StarIcon } from "./icons.js";
import { Suffixed } from "./text.js";

const cn = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/** Pixels per minute: an hour stands 72 pixels tall. */
const PX = 1.2;
/** How far blocks sit inside the panel's edges, so their corners nest in the panel's. */
const INSET = 4;

type Props = {
  days: BookingDay[];
  hostZone: string;
  bookerZone: string;
  host: string;
  length: number;
  selection: number | null;
  suggestions: number[];
  /** A phone's grid: three Days and only the booker's rail. */
  compact: boolean;
  onSelect: (start: number) => void;
  onConfirm: () => void;
};

type Located = { day: BookingDay; ms: number };

/** Now, once a minute, after hydration; null while the server renders. */
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * Days of open time drawn like Daybreak's schedule: a column per Day under
 * its weekday and date, open stretches washed blue, a star on the times best
 * for the host, and the meeting as a solid blue block. Press anywhere open to
 * put the meeting there, and drag it; it lands only where the whole length
 * fits. The booker's clock runs down the left rail, and on a computer the
 * host's down the right when it differs. Arrow keys do the same from the
 * keyboard.
 */
export function WeekStrip({
  days,
  hostZone,
  bookerZone,
  host,
  length,
  selection,
  suggestions,
  compact,
  onSelect,
  onConfirm,
}: Props) {
  const hintId = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ grab: number; columns: { day: BookingDay; rect: DOMRect }[] } | null>(null);
  const [dragging, setDragging] = useState(false);
  // The grid takes focus when pressed, so its keys work next; the ring is
  // for keyboard focus only.
  const [pressed, setPressed] = useState(false);
  const [hover, setHover] = useState<{ day: string; start: number } | null>(null);
  const now = useNow();

  const bounds = axisBounds(days, hostZone);
  const hours = axisHours(bounds);
  const height = (bounds.end - bounds.start) * PX + 2 * INSET;
  const y = (minute: number) => INSET + (minute - bounds.start) * PX;
  const top = (ms: number, day: string) => y(minuteOnDay(ms, day, hostZone));
  const span = length * MINUTE;
  const reference = days[0]?.day ?? zonedDate(Date.now(), hostZone);
  const referenceMoment = momentOnDay(reference, bounds.start, hostZone);
  const twoClocks = !sameClock(referenceMoment, hostZone, bookerZone);
  const hostRail = twoClocks && !compact;
  const rail = compact ? "2.5rem" : "3.25rem";

  const columns = () =>
    [...(gridRef.current?.querySelectorAll<HTMLElement>("[data-day]") ?? [])]
      .map((element) => ({ day: days.find((d) => d.day === element.dataset.day)!, rect: element.getBoundingClientRect() }))
      .filter((column) => column.day);

  const locate = (clientX: number, clientY: number, within: { day: BookingDay; rect: DOMRect }[]): Located | null => {
    if (within.length === 0) return null;
    const hit =
      within.find((c) => clientX >= c.rect.left && clientX < c.rect.right) ??
      within.reduce((best, c) =>
        Math.abs(c.rect.left + c.rect.width / 2 - clientX) < Math.abs(best.rect.left + best.rect.width / 2 - clientX) ? c : best,
      );
    const minute = bounds.start + (clientY - hit.rect.top - INSET) / PX;
    return { day: hit.day, ms: momentOnDay(hit.day.day, minute, hostZone) };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const within = columns();
    const at = locate(event.clientX, event.clientY, within);
    if (!at) return;
    const onSelection = selection !== null && (event.target as HTMLElement).closest("[data-selection]") !== null;
    // A tap on open time (not the meeting) lands only on that time, so a
    // phone's scroll that starts on a closed Day doesn't move the meeting.
    if (!onSelection && !at.day.open.some((s) => s.start <= at.ms && at.ms < s.end)) return;
    const grab = onSelection ? at.ms - selection : span / 2;
    const start = dragStart(at.day.open, at.ms, grab, length);
    if (start === null) return;
    if (event.pointerType === "mouse") event.preventDefault();
    setPressed(true);
    gridRef.current?.focus({ preventScroll: true });
    onSelect(start);
    drag.current = { grab, columns: within };
    setDragging(true);
    setHover(null);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      const at = locate(event.clientX, event.clientY, drag.current.columns);
      if (!at) return;
      const start = dragStart(at.day.open, at.ms, drag.current.grab, length);
      if (start !== null && start !== selection) onSelect(start);
      return;
    }
    if (event.pointerType !== "mouse") return;
    const at = locate(event.clientX, event.clientY, columns());
    const inOpen = at?.day.open.some((s) => s.start <= at.ms && at.ms < s.end);
    if (!at || !inOpen) {
      if (hover) setHover(null);
      return;
    }
    const start = dragStart(at.day.open, at.ms, span / 2, length);
    if (start === null) return;
    if (hover?.start !== start) setHover({ day: at.day.day, start });
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (event.key === "Enter" && selection !== null) {
      event.preventDefault();
      onConfirm();
      return;
    }
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = days.findIndex((d) => d.open.some((s) => selection !== null && s.start <= selection && selection < s.end));
    if (selection === null || index < 0) {
      const first = suggestions[0] ?? days.map((d) => startsIn(d.open, length)[0]).find((s) => s !== undefined);
      if (first !== undefined) onSelect(first);
      return;
    }
    const day = days[index]!;
    let next: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const direction = event.key === "ArrowDown" ? 1 : -1;
      next = stepStart(day.open, selection, length, direction);
      // Shift moves an hour at a time.
      for (let i = 1; event.shiftKey && next !== null && i < 60 / (length >= 30 ? 30 : 15); i++) {
        next = stepStart(day.open, next, length, direction) ?? next;
      }
    } else if (event.key === "Home" || event.key === "End") {
      const starts = startsIn(day.open, length);
      next = (event.key === "Home" ? starts[0] : starts.at(-1)) ?? null;
    } else {
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const minute = minuteOnDay(selection, day.day, hostZone);
      for (let i = index + direction; i >= 0 && i < days.length; i += direction) {
        const other = days[i]!;
        next = nearestStart(other.open, momentOnDay(other.day, minute, hostZone), length);
        if (next !== null) break;
      }
    }
    if (next !== null) onSelect(next);
  };

  const today = now === null ? null : zonedDate(now, hostZone);
  const nowMinute = now !== null && today !== null && days.some((d) => d.day === today) ? minuteOnDay(now, today, hostZone) : null;
  const nowShown = nowMinute !== null && nowMinute >= bounds.start && nowMinute <= bounds.end;
  const railLabels = (zone: string) =>
    hours.slice(1).map((minute) => (
      <span
        key={minute}
        className="dbk-rail-label"
        data-covered={nowShown && Math.abs(minute - nowMinute!) < 12 ? "" : undefined}
        style={{ top: y(minute) }}
      >
        <Suffixed text={hourLabel(momentOnDay(reference, minute, hostZone), zone)} />
      </span>
    ));
  const zoneHeading = (zone: string, who: string) => (
    <span className="dbk-zone-heading">
      <span>{zoneLabel(referenceMoment, zone)}</span>
      <span className="dbk-zone-who">{who}</span>
    </span>
  );

  return (
    <div className={cn("dbk-strip", compact && "dbk-strip-compact")}>
      <div
        className="dbk-strip-grid"
        style={{ gridTemplateColumns: [rail, `repeat(${Math.max(days.length, 1)}, minmax(0, 1fr))`, hostRail ? rail : "0"].join(" ") }}
      >
        <div />
        {days.map(({ day }) => (
          <div key={day} className="dbk-day-head">
            <span className="dbk-day-weekday">{weekdayLabel(day)}</span>
            <span className="dbk-day-date">
              <Suffixed text={dateLabel(day)} />
            </span>
          </div>
        ))}
        <div />

        <div className="dbk-rail dbk-rail-start" style={{ height }} aria-hidden>
          {zoneHeading(bookerZone, twoClocks ? "You" : `You & ${host}`)}
          {railLabels(bookerZone)}
          {nowShown && (
            <span className="dbk-now-pill" style={{ top: y(nowMinute!) }}>
              <Suffixed text={shortClock(now!, bookerZone)} />
            </span>
          )}
        </div>

        <div
          ref={gridRef}
          role="group"
          tabIndex={0}
          aria-label="Open times"
          aria-describedby={hintId}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={() => setHover(null)}
          onKeyDown={(event) => {
            setPressed(false);
            onKeyDown(event);
          }}
          onBlur={() => setPressed(false)}
          data-pressed={pressed ? "" : undefined}
          className="dbk-days"
          style={{
            gridColumn: `2 / span ${Math.max(days.length, 1)}`,
            gridTemplateColumns: `repeat(${Math.max(days.length, 1)}, minmax(0, 1fr))`,
            height,
          }}
        >
          {hours.slice(1, -1).map((minute) => (
            <div key={minute} className="dbk-hour-line" style={{ top: y(minute) }} aria-hidden />
          ))}
          {days.map(({ day, open }) => {
            const weekday = weekdayLabel(day);
            const isToday = day === today;
            return (
              <div
                key={day}
                data-day={day}
                data-closed={open.length === 0 ? "" : undefined}
                data-weekend={weekday === "Sat" || weekday === "Sun" ? "" : undefined}
                className="dbk-day"
              >
                {open.length === 0 && <span className="dbk-closed-note">No open times</span>}
                {bookableSpans(open, length).map((stretch) => (
                  <div
                    key={stretch.start}
                    className="dbk-open"
                    style={{ top: top(stretch.start, day), height: ((stretch.end - stretch.start) / MINUTE) * PX }}
                  />
                ))}
                {suggestions
                  .filter((start) => start !== selection && open.some((s) => s.start <= start && start < s.end))
                  .map((start) => (
                    <span
                      key={start}
                      className="dbk-best-dot"
                      title={`A best time for ${host}`}
                      style={{ top: top(start, day) + 2 }}
                    >
                      <StarIcon size={10} />
                    </span>
                  ))}
                {hover?.day === day && hover.start !== selection && (
                  <div className="dbk-ghost" style={{ top: top(hover.start, day), height: length * PX }} />
                )}
                {isToday && nowShown && <div className="dbk-now-line" style={{ top: y(nowMinute!) }} aria-hidden />}
                {selection !== null && open.some((s) => s.start <= selection && selection < s.end) && (
                  <div
                    data-selection
                    data-dragging={dragging ? "" : undefined}
                    data-best={suggestions.includes(selection) ? "" : undefined}
                    className="dbk-selection"
                    style={{ top: top(selection, day), height: length * PX }}
                  >
                    {length * PX >= 34 && (
                      <span className="dbk-selection-date">
                        {compact ? weekday : <Suffixed text={`${weekday}, ${dateLabel(day)}`} />}
                      </span>
                    )}
                    <span className="dbk-selection-time">
                      <Suffixed text={shortClock(selection, bookerZone)} />
                    </span>
                    {twoClocks && length * PX >= 56 && (
                      <span className="dbk-selection-host">
                        {shortClock(selection, hostZone)} {zoneLabel(selection, hostZone)}
                      </span>
                    )}
                    {suggestions.includes(selection) && (
                      <span className="dbk-selection-star" aria-hidden>
                        <StarIcon size={10} />
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="dbk-rail dbk-rail-end" style={{ height }} aria-hidden>
          {hostRail && (
            <>
              {zoneHeading(hostZone, host)}
              {railLabels(hostZone)}
            </>
          )}
        </div>
      </div>
      <p id={hintId} className="dbk-sr-only">
        Press an open time or drag the meeting. With the keyboard, arrow keys move it to the next start or another day,
        Shift moves an hour, and Enter goes to the form.
      </p>
    </div>
  );
}
