"use client";

import { type FormEvent, type ReactNode, type RefObject, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { callLabel, lengthLabel, weekStart } from "../page/days.js";
import { type Attempt, type BookResult, attemptFor, attemptKey, recoveryFor } from "../page/request.js";
import { MINUTE, dayHolding, resize, suggestedFor } from "../page/slots.js";
import { browserTimeZone, rangeLabel, slotSentence, slotText, zonedParts } from "../page/zones.js";
import type { Booked, BookingDay, BookingLink, BookingPage } from "../types.js";
import { type Transport, registrationOf, useWeek } from "./data.js";
import {
  ArrowClockwiseIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  MapPinIcon,
  SunIcon,
  VideoCameraIcon,
} from "./icons.js";
import { TimeList } from "./TimeList.js";
import { Turnstile, type TurnstileHandle } from "./Turnstile.js";
import { WeekStrip } from "./WeekStrip.js";

const noSubscription = () => () => undefined;

/** The browser's zone after hydration; null while the server renders. */
function useBookerZone() {
  return useSyncExternalStore(noSubscription, browserTimeZone, () => null);
}

const cn = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

type Selected = { start: number; day: BookingDay };

type Fields = {
  name: string;
  email: string;
  about: string;
  linkedin: string;
  phone: string;
};

const EMPTY: Fields = { name: "", email: "", about: "", linkedin: "", phone: "" };

/**
 * A Booking link's picker and form: lengths, a week of open time drawn like
 * Daybreak's schedule (a list of times on a narrow screen), and the
 * booker's details. Every time shows in the booker's zone and the host's.
 */
export function BookingPicker({
  slug,
  initial,
  transport,
  turnstileSiteKey,
  idPrefix,
  theme = "auto",
  onReload,
}: {
  slug: string;
  initial: BookingPage;
  transport: Transport;
  turnstileSiteKey?: string;
  idPrefix: string;
  theme?: "auto" | "light" | "dark";
  /** Reads the link's page again from the start, after the proxy said it changed. */
  onReload: () => void;
}) {
  const hostZone = initial.timeZone;
  const bookerZone = useBookerZone() ?? hostZone;
  const { host } = initial.link;

  const [week, setWeek] = useState(0);
  const from = weekStart(initial.firstDay, initial.lastDay, week) ?? initial.firstDay;
  const query = useWeek(transport, slug, from, { from: initial.firstDay, page: initial });
  const read = query.read;
  const page = read.status === "open" ? read.page : null;
  const days = page?.days ?? [];
  const link = page?.link ?? initial.link;

  const [length, setLength] = useState(initial.link.defaultLength);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [phoneDay, setPhoneDay] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [token, setToken] = useState<string | null>(null);
  const [failure, setFailure] = useState<Extract<BookResult, { ok: false }> | null>(null);
  const [booked, setBooked] = useState<{ booked: Booked; email: string } | null>(null);
  const [pending, setPending] = useState(false);
  const attempt = useRef<Attempt | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const bookedHeading = useRef<HTMLHeadingElement>(null);

  const suggestions = page ? suggestedFor(page.days, page.suggested, page.link.defaultLength, length) : [];
  const selection = selected?.start ?? null;

  const select = (start: number) => {
    const day = dayHolding(days, start);
    if (!day) return;
    setSelected({ start, day });
    setPhoneDay(day.day);
    setFailure(null);
  };

  const pickLength = (next: number) => {
    setLength(next);
    if (!selected) return;
    const start = resize(selected.day.open, selected.start, next);
    setSelected(start === null ? null : { start, day: selected.day });
  };

  useEffect(() => {
    if (booked) bookedHeading.current?.focus();
  }, [booked]);

  const slot = selection === null ? null : slotText(selection, selection + length * MINUTE, hostZone, bookerZone);
  const announcement = slot
    ? `${slotSentence(slot, host)}${suggestions.includes(selection!) ? `, a best time for ${host}` : ""}.`
    : "";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (selection === null || pending) return;
    const request = {
      start: selection,
      length,
      name: fields.name.trim(),
      email: fields.email.trim(),
      about: fields.about.trim(),
      ...(fields.linkedin.trim() ? { linkedin: fields.linkedin.trim() } : {}),
      ...(fields.phone.trim() ? { phone: fields.phone.trim() } : {}),
    };
    attempt.current = attemptFor(attempt.current, attemptKey(request));
    setPending(true);
    const registration = registrationOf(page) ?? registrationOf(initial);
    const answer = await transport.book(slug, {
      ...request,
      requestId: attempt.current.requestId,
      ...(token ? { turnstileToken: token } : {}),
      ...(registration ? { registration } : {}),
    });
    setPending(false);
    turnstile.current?.reset();
    if (answer.ok) {
      attempt.current = null;
      setBooked({ booked: answer.booked, email: request.email });
      query.invalidate();
      return;
    }
    setFailure(answer);
    if (recoveryFor(answer.code) === "repick") {
      attempt.current = null;
      setSelected(null);
      query.invalidate();
    }
  };

  const reset = () => {
    setBooked(null);
    setSelected(null);
    setFields((f) => ({ ...f, about: "" }));
    setFailure(null);
  };

  if (booked) {
    return (
      <Confirmation
        booked={booked.booked}
        email={booked.email}
        host={host}
        hostZone={hostZone}
        bookerZone={bookerZone}
        call={link.call}
        headingRef={bookedHeading}
        onAnother={reset}
      />
    );
  }

  const previous = weekStart(initial.firstDay, initial.lastDay, week - 1);
  const next = weekStart(initial.firstDay, initial.lastDay, week + 1);
  const needsToken = Boolean(turnstileSiteKey);
  const mustReload = failure !== null && recoveryFor(failure.code) === "reload";
  const canBook = selection !== null && !pending && !mustReload && (!needsToken || token !== null);
  const CallIcon = link.call.kind === "place" ? MapPinIcon : VideoCameraIcon;
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="dbk-layout">
      <p aria-live="polite" className="dbk-sr-only">
        {announcement}
      </p>

      <div className="dbk-main">
        <div className="dbk-toolbar">
          <div role="group" aria-label="Length" className="dbk-lengths">
            {link.lengths.map((option) => (
              <button
                key={option}
                type="button"
                className={cn("dbk-btn dbk-btn-sm dbk-tabular", option === length ? "dbk-btn-solid" : "dbk-btn-outline")}
                aria-pressed={option === length}
                onClick={() => pickLength(option)}
              >
                {lengthLabel(option)}
              </button>
            ))}
          </div>
          <div className="dbk-weeks">
            <button
              type="button"
              className="dbk-btn dbk-btn-icon dbk-btn-ghost"
              aria-label="Earlier week"
              disabled={previous === null}
              onClick={() => setWeek((w) => w - 1)}
            >
              <CaretLeftIcon />
            </button>
            <span className="dbk-range dbk-tabular">
              {days.length > 0 ? rangeLabel(days[0]!.day, days.at(-1)!.day) : ""}
            </span>
            <button
              type="button"
              className="dbk-btn dbk-btn-icon dbk-btn-ghost"
              aria-label="Later week"
              disabled={next === null}
              onClick={() => setWeek((w) => w + 1)}
            >
              <CaretRightIcon />
            </button>
          </div>
        </div>

        {failure && recoveryFor(failure.code) === "repick" && (
          <p role="alert" className="dbk-alert">
            {failure.message}
          </p>
        )}

        {read.status === "unavailable" ? (
          <div className="dbk-empty dbk-row">
            Couldn&apos;t load these days.
            <button type="button" className="dbk-btn dbk-btn-sm dbk-btn-outline" onClick={query.refetch}>
              <ArrowClockwiseIcon />
              Try again
            </button>
          </div>
        ) : read.status === "closed" ? (
          <p className="dbk-empty">{read.message}</p>
        ) : (
          <div aria-busy={query.isPlaceholder} className={cn("dbk-days", query.isPlaceholder && "dbk-faded")}>
            <div className="dbk-wide-only">
              <WeekStrip
                days={days}
                hostZone={hostZone}
                bookerZone={bookerZone}
                host={host}
                length={length}
                selection={selection}
                suggestions={suggestions}
                onSelect={select}
                onConfirm={() => nameField.current?.focus()}
              />
            </div>
            <div className="dbk-narrow-only">
              <TimeList
                days={days}
                activeDay={phoneDay}
                hostZone={hostZone}
                bookerZone={bookerZone}
                host={host}
                length={length}
                selection={selection}
                suggestions={suggestions}
                onDay={setPhoneDay}
                onSelect={select}
              />
            </div>
            {suggestions.length > 0 && (
              <p className="dbk-legend">
                <SunIcon size={13} className="dbk-legend-sun" />
                <span>
                  A sun marks the times that suit {host} best: next to other meetings or at the edge of open time, so
                  longer stretches stay free.
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      <aside aria-label="Your booking" className="dbk-aside">
        <form onSubmit={(event) => void submit(event)} className="dbk-card dbk-form">
          <div>
            {slot ? (
              <>
                <p className="dbk-eyebrow">
                  {lengthLabel(length)}
                  {suggestions.includes(selection!) && (
                    <span className="dbk-best-tag">
                      <SunIcon size={12} />
                      Best for {host}
                    </span>
                  )}
                </p>
                <p className="dbk-slot-day">{slot.booker.day}</p>
                <p className="dbk-slot-time dbk-tabular">
                  {slot.booker.start} - {slot.booker.end} <span className="dbk-muted">{slot.booker.zone}</span>
                </p>
                {!slot.sameClock && (
                  <p className="dbk-small dbk-muted dbk-tabular">
                    {slot.host.start} {slot.host.zone} for {host}
                    {slot.dateDiffers && `, ${slot.host.day}`}
                  </p>
                )}
              </>
            ) : (
              <p className="dbk-small dbk-muted">
                Pick a length and a time. Every time shows in your zone and {host}&apos;s.
              </p>
            )}
          </div>

          <p className="dbk-call dbk-small dbk-muted">
            <CallIcon size={16} />
            {callLabel(link.call)}
            {link.call.kind !== "place" && ". The link comes with the invite."}
          </p>

          <fieldset disabled={pending} className="dbk-fields">
            <Field label="Name" id={id("name")}>
              <input
                ref={nameField}
                id={id("name")}
                className="dbk-input"
                required
                maxLength={100}
                autoComplete="name"
                value={fields.name}
                onChange={(e) => setFields({ ...fields, name: e.target.value })}
              />
            </Field>
            <Field label="Email" id={id("email")} hint="The invite goes here.">
              <input
                id={id("email")}
                className="dbk-input"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={fields.email}
                onChange={(e) => setFields({ ...fields, email: e.target.value })}
              />
            </Field>
            <Field label="What it's about" id={id("about")} hint="One line. It titles the invite.">
              <input
                id={id("about")}
                className="dbk-input"
                required
                maxLength={200}
                value={fields.about}
                onChange={(e) => setFields({ ...fields, about: e.target.value })}
              />
            </Field>
            <Field label="LinkedIn" id={id("linkedin")} optional>
              <input
                id={id("linkedin")}
                className="dbk-input"
                inputMode="url"
                maxLength={200}
                autoComplete="url"
                placeholder="linkedin.com/in/you"
                value={fields.linkedin}
                onChange={(e) => setFields({ ...fields, linkedin: e.target.value })}
              />
            </Field>
            <Field
              label="Phone"
              id={id("phone")}
              optional
              hint="In case the call link fails. Outside the US, start with +."
            >
              <input
                id={id("phone")}
                className="dbk-input"
                type="tel"
                inputMode="tel"
                maxLength={40}
                autoComplete="tel"
                value={fields.phone}
                onChange={(e) => setFields({ ...fields, phone: e.target.value })}
              />
            </Field>
          </fieldset>

          {turnstileSiteKey && <Turnstile ref={turnstile} siteKey={turnstileSiteKey} onToken={setToken} theme={theme} />}

          {failure && mustReload ? (
            <div role="alert" className="dbk-alert dbk-row">
              {failure.message}
              <button type="button" className="dbk-btn dbk-btn-sm dbk-btn-outline" onClick={onReload}>
                <ArrowClockwiseIcon />
                Reload
              </button>
            </div>
          ) : (
            failure &&
            recoveryFor(failure.code) !== "repick" && (
              <p role="alert" className="dbk-alert">
                {failure.message}
              </p>
            )
          )}

          <button type="submit" className="dbk-btn dbk-btn-solid dbk-btn-block" disabled={!canBook}>
            {pending
              ? "Booking..."
              : failure && recoveryFor(failure.code) === "retry"
                ? "Try again"
                : selection === null
                  ? "Pick a time first"
                  : `Book ${lengthLabel(length)}`}
          </button>
          {needsToken && token === null && selection !== null && !pending && (
            <p className="dbk-hint dbk-center">Checking you&apos;re a person...</p>
          )}
        </form>
      </aside>
    </div>
  );
}

function Field({
  label,
  id,
  hint,
  optional,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="dbk-field">
      <label htmlFor={id} className="dbk-label">
        {label}
        {optional && <span className="dbk-optional">Optional</span>}
      </label>
      {children}
      {hint && <p className="dbk-hint">{hint}</p>}
    </div>
  );
}

function Confirmation({
  booked,
  email,
  host,
  hostZone,
  bookerZone,
  call,
  headingRef,
  onAnother,
}: {
  booked: Booked;
  email: string;
  host: string;
  hostZone: string;
  bookerZone: string;
  call: BookingLink["call"];
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAnother: () => void;
}) {
  const slot = slotText(booked.start, booked.end, hostZone, bookerZone);
  const light = zonedParts(booked.start, bookerZone).hour < 12 ? "am" : "pm";
  return (
    <section data-light={light} className="dbk-postcard">
      <CheckCircleIcon size={32} className="dbk-done-icon" />
      <h2 ref={headingRef} tabIndex={-1} className="dbk-postcard-title">
        You&apos;re meeting {host}
      </h2>
      <p className="dbk-postcard-day">{slot.booker.day}</p>
      <p className="dbk-postcard-time dbk-tabular">
        {slot.booker.start} - {slot.booker.end} <span className="dbk-muted">your time, {slot.booker.zone}</span>
      </p>
      {!slot.sameClock && (
        <p className="dbk-muted dbk-tabular dbk-gap-top-xs">
          {slot.host.start} - {slot.host.end} {slot.host.zone} for {host}
          {slot.dateDiffers && `, ${slot.host.day}`}
        </p>
      )}
      <p className="dbk-invite">
        <EnvelopeSimpleIcon size={18} className="dbk-invite-icon" />
        <span>
          The invite is in your inbox at <span className="dbk-strong">{email}</span>
          {call.kind === "meet"
            ? ", with the Google Meet link."
            : call.kind === "place"
              ? `, at ${call.location ?? "the place"}.`
              : ", with the call link."}
        </span>
      </p>
      <p className="dbk-small dbk-muted dbk-gap-top-xs">{booked.title}</p>
      <button type="button" className="dbk-btn dbk-btn-outline dbk-gap-top-lg" onClick={onAnother}>
        Book another time
      </button>
    </section>
  );
}
