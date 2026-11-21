"use client";

import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { PHONE_DAYS, WEEK, callLabel, daysFitting, lengthLabel, lengthWords, stepLabel, windowStart } from "../page/days.js";
import type { LengthChoice } from "../page/links.js";
import {
  type Attempt,
  type BookResult,
  GUESTS_MOST,
  MEETING_NAME_LENGTH,
  attemptFor,
  attemptKey,
  linkedinAddress,
  recoveryFor,
  titleLead,
} from "../page/request.js";
import { MINUTE, dayHolding, firstPick, fits, resize, suggestedFor } from "../page/slots.js";
import { browserTimeZone, slotSentence, slotText, untilLabel, zonedParts } from "../page/zones.js";
import type { Booked, BookingDay, BookingLink, BookingPage } from "../types.js";
import { type Transport, registrationOf, useWeek } from "./data.js";
import {
  ArrowClockwiseIcon,
  ArrowUUpLeftIcon,
  CaretLeftBoldIcon,
  CaretRightBoldIcon,
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  MapPinRegularIcon,
  PencilSimpleIcon,
  PlusIcon,
  StarIcon,
  VideoCameraRegularIcon,
  XIcon,
} from "./icons.js";
import { Suffixed } from "./text.js";
import { Turnstile, type TurnstileHandle } from "./Turnstile.js";
import { WeekStrip } from "./WeekStrip.js";

const noSubscription = () => () => undefined;

/** The browser's zone after hydration; null while the server renders. */
function useBookerZone() {
  return useSyncExternalStore(noSubscription, browserTimeZone, () => null);
}

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The page's width at two breakpoints: whether it stacks, and how many Days fit beside the card. */
function useLayout(root: RefObject<HTMLDivElement | null>, column: RefObject<HTMLDivElement | null>) {
  const [layout, setLayout] = useState({ narrow: false, count: WEEK });
  useClientLayoutEffect(() => {
    const measure = () => {
      const width = root.current?.getBoundingClientRect().width ?? 0;
      const columnWidth = column.current?.getBoundingClientRect().width ?? width;
      if (width === 0) return;
      const narrow = width < NARROW;
      const count = narrow ? PHONE_DAYS : daysFitting(columnWidth, false);
      setLayout((previous) => (previous.narrow === narrow && previous.count === count ? previous : { narrow, count }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    if (root.current) observer.observe(root.current);
    if (column.current) observer.observe(column.current);
    return () => observer.disconnect();
  }, []);
  return layout;
}

/** Under this width the card goes under the grid, as /meet's 872px. */
const NARROW = 872;

const cn = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

type Selected = { start: number; day: BookingDay };

type GuestRow = { key: number; name: string; email: string };

type Fields = {
  name: string;
  email: string;
  about: string;
  linkedin: string;
  phone: string;
  meetingName: string;
};

const EMPTY: Fields = { name: "", email: "", about: "", linkedin: "", phone: "", meetingName: "" };

/**
 * A Booking link's page, as /meet draws it: the title and length, a length
 * choice when there's more than one, a grid of Days to pick a time on, and a
 * card with the time and the booker's details. Every time shows in the
 * booker's zone, and the host's beside it when it differs.
 */
export function BookingPicker({
  slug,
  initial,
  choices,
  transport,
  turnstileSiteKey,
  idPrefix,
  heading,
  theme = "auto",
  onReload,
}: {
  slug: string;
  initial: BookingPage;
  /** The lengths to offer and the link each books, the link's siblings' included. */
  choices: LengthChoice[];
  transport: Transport;
  turnstileSiteKey?: string;
  idPrefix: string;
  heading: boolean;
  theme?: "auto" | "light" | "dark";
  /** Reads the link's page again from the start, after the proxy said it changed. */
  onReload: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLDivElement>(null);
  const { narrow, count } = useLayout(root, column);
  const hostZone = initial.timeZone;
  const bookerZone = useBookerZone() ?? hostZone;
  const { host } = initial.link;

  const [length, setLength] = useState(initial.link.defaultLength);
  const active = choices.find((choice) => choice.length === length)?.slug ?? slug;
  const [offset, setOffset] = useState(0);
  // Each read is a week from the window's first Day; the grid shows as many of them as fit.
  const from = windowStart(initial.firstDay, initial.lastDay, offset) ?? initial.firstDay;
  const query = useWeek(transport, active, from, { slug, from: initial.firstDay, page: initial });
  const read = query.read;
  const page = read.status === "open" ? read.page : null;
  const allDays = page?.days ?? [];
  const days = allDays.slice(0, count);
  const link = page?.link ?? initial.link;
  const lastDay = page?.lastDay ?? initial.lastDay;

  const [selected, setSelected] = useState<Selected | null>(null);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [failure, setFailure] = useState<Extract<BookResult, { ok: false }> | null>(null);
  const [booked, setBooked] = useState<{ booked: Booked; email: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [formInView, setFormInView] = useState(false);
  const attempt = useRef<Attempt | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  const form = useRef<HTMLFormElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const bookedHeading = useRef<HTMLHeadingElement>(null);
  const guestKey = useRef(0);
  const picked = useRef(false);

  const suggestions = page ? suggestedFor(page.days, page.suggested, page.link.defaultLength, length) : [];
  const selection = selected?.start ?? null;
  const best = selection !== null && suggestions.includes(selection);

  // The first time the page has open time, the meeting starts on the best time, as /meet's does.
  useEffect(() => {
    if (picked.current || !page || query.isPlaceholder) return;
    const start = firstPick(days, suggestedFor(days, page.suggested, page.link.defaultLength, length), length);
    if (start === null) return;
    picked.current = true;
    const day = dayHolding(days, start);
    if (day) setSelected({ start, day });
  }, [page, query.isPlaceholder, days, length]);

  // A sibling link's page may not have the time picked on the last one.
  useEffect(() => {
    if (!selected || !page || query.isPlaceholder) return;
    const day = dayHolding(page.days, selected.start);
    if (!day) return;
    if (fits(day.open, selected.start, length)) return;
    const start = resize(day.open, selected.start, length);
    setSelected(start === null ? null : { start, day });
  }, [page, query.isPlaceholder, selected, length]);

  // On a phone, the bar at the foot carries the time until the card is in view.
  useEffect(() => {
    if (!narrow || !form.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setFormInView(Boolean(entry?.isIntersecting)), {
      threshold: 0.2,
    });
    observer.observe(form.current);
    return () => observer.disconnect();
  }, [narrow, booked]);

  useEffect(() => {
    if (booked) bookedHeading.current?.focus();
  }, [booked]);

  const select = (start: number) => {
    const day = dayHolding(allDays, start);
    if (!day) return;
    setSelected({ start, day });
    setFailure(null);
  };

  const pickLength = (next: number) => {
    setLength(next);
    if (!selected) return;
    const start = resize(selected.day.open, selected.start, next);
    setSelected(start === null ? null : { start, day: selected.day });
  };

  const backToBest = () => {
    if (selection === null || suggestions.length === 0) return;
    const nearest = suggestions.reduce((a, b) => (Math.abs(b - selection) < Math.abs(a - selection) ? b : a));
    select(nearest);
  };

  const slot = selection === null ? null : slotText(selection, selection + length * MINUTE, hostZone, bookerZone);
  const announcement = slot ? `${slotSentence(slot, host)}${best ? `, a best time for ${host}` : ""}.` : "";
  const guestList = guests
    .filter((guest) => guest.email.trim() !== "")
    .map((guest) => ({ email: guest.email.trim(), ...(guest.name.trim() ? { name: guest.name.trim() } : {}) }));
  const lead = fields.name.trim() ? titleLead(fields.name, guestList, fields.meetingName) : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (selection === null || pending) return;
    const linkedin = linkedinAddress(fields.linkedin);
    const request = {
      start: selection,
      length,
      name: fields.name.trim(),
      email: fields.email.trim(),
      ...(fields.about.trim() ? { about: fields.about.trim() } : {}),
      ...(linkedin ? { linkedin } : {}),
      ...(phoneOpen && fields.phone.trim() ? { phone: fields.phone.trim() } : {}),
      ...(guestList.length > 0 ? { guests: guestList } : {}),
      ...(fields.meetingName.trim() ? { meetingName: fields.meetingName.trim() } : {}),
    };
    attempt.current = attemptFor(attempt.current, `${active} ${attemptKey(request)}`);
    setPending(true);
    const registration = registrationOf(page) ?? registrationOf(initial);
    const answer = await transport.book(active, {
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
    setFields((f) => ({ ...f, about: "", meetingName: "" }));
    setGuests([]);
    setFailure(null);
  };

  const title = heading ? (
    <header className="dbk-header">
      <h2 className="dbk-title">{link.title}</h2>
      <p className="dbk-facts">
        <Suffixed text={lengthLabel(length)} /> · {callLabel(link.call)}
      </p>
    </header>
  ) : null;

  if (booked) {
    return (
      <div ref={root} className="dbk-page">
        {title}
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
      </div>
    );
  }

  const stride = narrow ? PHONE_DAYS : count;
  const previous = offset - stride >= 0 ? offset - stride : offset > 0 ? 0 : null;
  const nextFrom = windowStart(initial.firstDay, lastDay, offset + stride);
  const needsToken = Boolean(turnstileSiteKey);
  const mustReload = failure !== null && recoveryFor(failure.code) === "reload";
  const canBook = selection !== null && !pending && !mustReload && (!needsToken || token !== null);
  const CallIcon = link.call.kind === "place" ? MapPinRegularIcon : VideoCameraRegularIcon;
  const id = (name: string) => `${idPrefix}-${name}`;
  const until = slot && selection !== null ? untilLabel(selection, Date.now(), bookerZone) : null;
  const setField = (name: keyof Fields) => (event: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [name]: event.target.value }));

  const nav = (
    <nav className="dbk-nav" aria-label="Days">
      <button
        type="button"
        className="dbk-chevron"
        aria-label="Earlier days"
        disabled={previous === null}
        onClick={() => previous !== null && setOffset(previous)}
      >
        <CaretLeftBoldIcon size={13} />
      </button>
      <button
        type="button"
        className="dbk-nav-label"
        disabled={offset === 0}
        aria-label={offset === 0 ? undefined : `${stepLabel(offset, stride)}, back to the first days`}
        onClick={() => setOffset(0)}
      >
        {stepLabel(offset, stride)}
        {offset > 0 && <span className="dbk-nav-dot" aria-hidden />}
      </button>
      <button
        type="button"
        className="dbk-chevron"
        aria-label="Later days"
        disabled={nextFrom === null}
        onClick={() => nextFrom !== null && setOffset(offset + stride)}
      >
        <CaretRightBoldIcon size={13} />
      </button>
    </nav>
  );

  const when = slot ? (
    <div className="dbk-when">
      <div className="dbk-when-text">
        <p className="dbk-when-day">
          <Suffixed text={slot.booker.day} />
          {until?.day && <span className="dbk-aside"> · {until.time ?? until.day}</span>}
        </p>
        <p className="dbk-when-time">
          <Suffixed text={slot.booker.short.start} />
          <span className="dbk-dash">-</span>
          <Suffixed text={slot.booker.short.end} /> <span className="dbk-zone">{slot.booker.zone}</span>
        </p>
        {!slot.sameClock && (
          <p className="dbk-when-host">
            <Suffixed text={`${slot.host.short.start}-${slot.host.short.end}`} /> {slot.host.zone} for {host}
            {slot.dateDiffers && `, ${slot.host.day}`}
          </p>
        )}
      </div>
      {best ? (
        <span className="dbk-capsule">
          <StarIcon size={11} />
          Best
        </span>
      ) : suggestions.length > 0 ? (
        <button type="button" className="dbk-capsule-back" onClick={backToBest} aria-label={`Back to a best time for ${host}`}>
          <ArrowUUpLeftIcon size={11} />
          Best
        </button>
      ) : null}
    </div>
  ) : (
    <p className="dbk-muted dbk-small">Pick a time on the left. Every time shows in your zone.</p>
  );

  return (
    <div ref={root} className={cn("dbk-page", narrow && "dbk-narrow")}>
      <p aria-live="polite" className="dbk-sr-only">
        {announcement}
      </p>
      {title}
      <div className="dbk-layout">
        <div ref={column} className="dbk-main">
          <div className="dbk-toolbar">
            <div>
              {choices.length > 1 && (
                <div role="group" aria-label="Length" className="dbk-segmented">
                  {choices.map((choice) => (
                    <button
                      key={choice.length}
                      type="button"
                      className="dbk-segment"
                      aria-pressed={choice.length === length}
                      aria-label={lengthWords(choice.length)}
                      onClick={() => pickLength(choice.length)}
                    >
                      <Suffixed text={lengthLabel(choice.length)} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            {nav}
            <div />
          </div>

          {failure && recoveryFor(failure.code) === "repick" && (
            <p role="alert" className="dbk-alert">
              {failure.message}
            </p>
          )}

          {read.status === "unavailable" ? (
            <div className="dbk-empty">
              Couldn&apos;t load these days.
              <button type="button" className="dbk-quiet dbk-quiet-sm" onClick={query.refetch}>
                <ArrowClockwiseIcon />
                Try again
              </button>
            </div>
          ) : read.status === "closed" ? (
            <p className="dbk-empty">{read.message}</p>
          ) : (
            <div aria-busy={query.isPlaceholder} className={cn(query.isPlaceholder && "dbk-faded")}>
              <WeekStrip
                days={days}
                hostZone={hostZone}
                bookerZone={bookerZone}
                host={host}
                length={length}
                selection={selection}
                suggestions={suggestions}
                compact={narrow}
                onSelect={select}
                onConfirm={() => nameField.current?.focus()}
              />
            </div>
          )}
        </div>

        <aside aria-label="Your booking" className="dbk-aside">
          <form ref={form} onSubmit={(event) => void submit(event)} className="dbk-card">
            {when}

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
                  onChange={setField("name")}
                />
              </Field>
              <Field label="Email" id={id("email")}>
                <input
                  id={id("email")}
                  className="dbk-input"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={fields.email}
                  onChange={setField("email")}
                />
              </Field>

              {guests.length > 0 && (
                <div className="dbk-field">
                  <span className="dbk-label">Guests</span>
                  {guests.map((guest, index) => (
                    <div key={guest.key} className="dbk-guest">
                      <input
                        className="dbk-input"
                        aria-label={`Guest ${index + 1}'s name`}
                        placeholder="Name"
                        maxLength={100}
                        value={guest.name}
                        onChange={(e) =>
                          setGuests((rows) => rows.map((row) => (row.key === guest.key ? { ...row, name: e.target.value } : row)))
                        }
                      />
                      <input
                        className="dbk-input"
                        type="email"
                        aria-label={`Guest ${index + 1}'s email`}
                        placeholder="Email"
                        maxLength={254}
                        required
                        value={guest.email}
                        onChange={(e) =>
                          setGuests((rows) => rows.map((row) => (row.key === guest.key ? { ...row, email: e.target.value } : row)))
                        }
                      />
                      <button
                        type="button"
                        className="dbk-remove"
                        aria-label={`Remove guest ${index + 1}`}
                        onClick={() => setGuests((rows) => rows.filter((row) => row.key !== guest.key))}
                      >
                        <XIcon size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {phoneOpen && (
                <Field label="Phone" id={id("phone")} hint="In case the call link fails. Outside the US, start with +.">
                  <div className="dbk-phone">
                    <input
                      id={id("phone")}
                      className="dbk-input"
                      type="tel"
                      inputMode="tel"
                      maxLength={40}
                      autoComplete="tel"
                      value={fields.phone}
                      onChange={setField("phone")}
                    />
                    <button
                      type="button"
                      className="dbk-remove"
                      aria-label="Remove phone"
                      onClick={() => {
                        setPhoneOpen(false);
                        setFields((f) => ({ ...f, phone: "" }));
                      }}
                    >
                      <XIcon size={12} />
                    </button>
                  </div>
                </Field>
              )}

              {(guests.length < GUESTS_MOST || !phoneOpen) && (
                <div className="dbk-adds">
                  {guests.length < GUESTS_MOST && (
                    <button
                      type="button"
                      className="dbk-add"
                      onClick={() => setGuests((rows) => [...rows, { key: ++guestKey.current, name: "", email: "" }])}
                    >
                      <PlusIcon size={12} />
                      {guests.length === 0 ? "Add guests" : "Add another"}
                    </button>
                  )}
                  {!phoneOpen && (
                    <button type="button" className="dbk-add" onClick={() => setPhoneOpen(true)}>
                      <PlusIcon size={12} />
                      Add phone
                    </button>
                  )}
                </div>
              )}

              <Field label="LinkedIn" id={id("linkedin")} optional>
                <input
                  id={id("linkedin")}
                  className="dbk-input"
                  inputMode="url"
                  maxLength={200}
                  autoComplete="url"
                  placeholder="/in/you"
                  value={fields.linkedin}
                  onChange={setField("linkedin")}
                />
              </Field>
              <Field label="What it's about" id={id("about")} optional>
                <textarea
                  id={id("about")}
                  className="dbk-input dbk-growing"
                  rows={1}
                  maxLength={200}
                  value={fields.about}
                  onChange={setField("about")}
                />
              </Field>
            </fieldset>

            {turnstileSiteKey && <Turnstile ref={turnstile} siteKey={turnstileSiteKey} onToken={setToken} theme={theme} />}

            <p className="dbk-call">
              <CallIcon size={17} />
              <span>{callLabel(link.call)}</span>
              {lead !== null && !naming && (
                <span className="dbk-call-title">
                  · {lead} 🤝 {host}
                </span>
              )}
              {naming ? (
                <span className="dbk-naming">
                  <input
                    className="dbk-meeting-name"
                    aria-label="The meeting's name"
                    maxLength={MEETING_NAME_LENGTH}
                    placeholder={lead ?? "Name the meeting"}
                    autoFocus
                    value={fields.meetingName}
                    onChange={setField("meetingName")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") {
                        e.preventDefault();
                        if (e.key === "Escape") setFields((f) => ({ ...f, meetingName: "" }));
                        setNaming(false);
                      }
                    }}
                  />
                  <span className="dbk-muted">🤝 {host}</span>
                  <button type="button" className="dbk-remove" aria-label="Done naming" onClick={() => setNaming(false)}>
                    <XIcon size={11} />
                  </button>
                </span>
              ) : (
                lead !== null && (
                  <button type="button" className="dbk-remove" aria-label="Name the meeting" onClick={() => setNaming(true)}>
                    <PencilSimpleIcon size={12} />
                  </button>
                )
              )}
            </p>

            {failure && mustReload ? (
              <div role="alert" className="dbk-alert">
                {failure.message}
                <button type="button" className="dbk-quiet dbk-quiet-sm" onClick={onReload}>
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

            <button type="submit" className="dbk-primary" disabled={!canBook}>
              {pending ? (
                "Booking..."
              ) : failure && recoveryFor(failure.code) === "retry" ? (
                "Try again"
              ) : selection === null ? (
                "Pick a time first"
              ) : (
                <>
                  Book <Suffixed text={lengthLabel(length)} />
                </>
              )}
            </button>
            {needsToken && token === null && selection !== null && !pending && (
              <p className="dbk-checking">Checking you&apos;re a person...</p>
            )}
          </form>
        </aside>
      </div>

      {narrow && slot && !formInView && (
        <button
          type="button"
          className="dbk-peek"
          onClick={() => {
            form.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            nameField.current?.focus({ preventScroll: true });
          }}
        >
          {when}
          <span className="dbk-peek-hint">Book this time</span>
        </button>
      )}
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
    <section data-light={light} className="dbk-card dbk-done">
      <CheckCircleIcon size={32} className="dbk-done-icon" />
      <h2 ref={headingRef} tabIndex={-1} className="dbk-done-title">
        You&apos;re meeting {host}
      </h2>
      <p className="dbk-when-day">
        <Suffixed text={slot.booker.day} />
      </p>
      <p className="dbk-when-time">
        <Suffixed text={slot.booker.short.start} />
        <span className="dbk-dash">-</span>
        <Suffixed text={slot.booker.short.end} /> <span className="dbk-zone">{slot.booker.zone}</span>
      </p>
      {!slot.sameClock && (
        <p className="dbk-when-host">
          <Suffixed text={`${slot.host.short.start}-${slot.host.short.end}`} /> {slot.host.zone} for {host}
          {slot.dateDiffers && `, ${slot.host.day}`}
        </p>
      )}
      <p className="dbk-invite">
        <EnvelopeSimpleIcon size={18} />
        <span>
          The invite is in your inbox at <span className="dbk-strong">{email}</span>
          {call.kind === "meet"
            ? ", with the Google Meet link."
            : call.kind === "place"
              ? `, at ${call.location ?? "the place"}.`
              : ", with the call link."}
        </span>
      </p>
      <p className="dbk-muted dbk-small">{booked.title}</p>
      <button type="button" className="dbk-quiet" onClick={onAnother}>
        Book another time
      </button>
    </section>
  );
}
