"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { MeetScreen } from "../meet/MeetScreen.js";
import { MeetHostContext, useResolvedTheme } from "../meet/host.js";
import { lengthLabel } from "../page/page.js";
import { type LinkGroup, linkGroups } from "../page/links.js";
import type { BookingPage } from "../types.js";
import { type LinksRead, type Transport, createTransport } from "./data.js";
import { ArrowClockwiseIcon, CaretRightBoldIcon } from "./icons.js";
import { BOOKING_CSS } from "./styles.js";
import { Suffixed } from "./text.js";

export type DaybreakBookingProps = {
  /**
   * The proxy's address: `bookingHandler`'s mount (`/api/booking`), or the
   * Daybreak site's `/api/u/<name>`. The page calls `GET <api>`,
   * `GET <api>/<slug>`, and `POST <api>/<slug>`, never the deployment.
   */
  api: string;
  /**
   * The Booking link to show. Without it, the page lists the links, one card
   * per title. Links with the link's title and family (`meet` beside `15`
   * and `60`, `coffee` beside `coffee-15`) are its lengths: the page offers
   * each, and books the one picked with its own link.
   */
  slug?: string;
  /** The link's first 28 Days, read on the server, so the page draws without waiting. */
  initial?: BookingPage;
  /** Cloudflare Turnstile's site key. With it, a booking carries `turnstileToken`, which the proxy checks. */
  turnstileSiteKey?: string;
  /** The link's title and its length and call, above the Days. On unless false. */
  heading?: boolean;
  /** "auto" (the default) follows the system's light or dark. */
  theme?: "auto" | "light" | "dark";
  /** The host's photo, square, drawn in the ring of dust. Without it, the host's initials stand in its place. */
  photo?: string;
  /** The way back to the host's site from the closed page, as `{ href: "/", label: "example.com" }`. The ticket's back is Daybreak's word, linked to Daybreak's site, whatever this says. */
  home?: { href: string; label: string };
  /** Where each listed link goes. Without it, picking a link opens it in place. */
  linkHref?: (slug: string) => string;
  /** Adds the page's stylesheet to its document or shadow root. On unless false, for a site that loads `@coordination/booking/styles.css` itself. */
  injectStyles?: boolean;
  /** For tests, or a fetch that needs wrapping. */
  fetch?: typeof fetch;
  className?: string;
};

/**
 * A Daybreak booking page: a link's open time and a form to book it, drawn
 * as Daybreak's own booking page draws it, or the list of links. One
 * component for React sites, `<daybreak-booking>`, and the Daybreak site's
 * `/u/` pages.
 */
export function DaybreakBooking(props: DaybreakBookingProps) {
  const { api, injectStyles = true, className } = props;
  const theme = useResolvedTheme(props.theme ?? "auto");
  const root = useRef<HTMLDivElement>(null);
  const transport = useMemo(() => createTransport(api, props.fetch), [api, props.fetch]);
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const slug = props.slug ?? picked;

  useStyles(root, injectStyles);

  return (
    <div
      ref={root}
      className={["dbk-meet", theme === "dark" ? "dark" : null, className].filter(Boolean).join(" ")}
    >
      {slug ? (
        <LinkPage
          key={slug}
          slug={slug}
          transport={transport}
          initial={props.slug === slug ? props.initial : undefined}
          turnstileSiteKey={props.turnstileSiteKey}
          heading={props.heading ?? true}
          theme={theme}
          photo={props.photo}
          home={props.home}
        />
      ) : (
        <LinkList
          transport={transport}
          linkHref={props.linkHref}
          onPick={setPicked}
          heading={props.heading ?? true}
          theme={theme}
        />
      )}
    </div>
  );
}

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

let sheet: CSSStyleSheet | null = null;

/** Adds the stylesheet once to whichever document or shadow root holds the page. */
function useStyles(root: React.RefObject<HTMLDivElement | null>, inject: boolean) {
  useClientLayoutEffect(() => {
    const node = root.current?.getRootNode();
    if (!inject || !node) return;
    const target = node as Document | ShadowRoot;
    if ("adoptedStyleSheets" in target && typeof CSSStyleSheet !== "undefined" && "replaceSync" in CSSStyleSheet.prototype) {
      try {
        sheet ??= new CSSStyleSheet();
        if (sheet.cssRules.length === 0) sheet.replaceSync(BOOKING_CSS);
        if (!target.adoptedStyleSheets.includes(sheet)) target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
        return;
      } catch {
        // A runtime without constructable sheets falls through to a <style>.
      }
    }
    const parent = target instanceof Document ? target.head : target;
    if (parent.querySelector("style[data-daybreak-booking]")) return;
    const style = document.createElement("style");
    style.dataset.daybreakBooking = "";
    style.textContent = BOOKING_CSS;
    parent.appendChild(style);
  }, [inject]);
}

function LinkPage({
  slug,
  transport,
  initial,
  turnstileSiteKey,
  heading,
  theme,
  photo,
  home,
}: {
  slug: string;
  transport: Transport;
  initial: BookingPage | undefined;
  turnstileSiteKey: string | undefined;
  heading: boolean;
  theme: "light" | "dark";
  photo: string | undefined;
  home: { href: string; label: string } | undefined;
}) {
  const host = useMemo(
    () => ({ theme, ...(photo ? { photo } : {}), ...(home ? { home } : {}) }),
    [theme, photo, home],
  );

  return (
    <MeetHostContext.Provider value={host}>
      <MeetScreen
        slug={slug}
        transport={transport}
        heading={heading}
        {...(initial ? { initial } : {})}
        {...(turnstileSiteKey ? { turnstileSiteKey } : {})}
      />
    </MeetHostContext.Provider>
  );
}

function LinkList({
  transport,
  linkHref,
  onPick,
  heading,
  theme,
}: {
  transport: Transport;
  linkHref: ((slug: string) => string) | undefined;
  onPick: (slug: string) => void;
  heading: boolean;
  theme: "light" | "dark";
}) {
  const [read, setRead] = useState<LinksRead | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRead(null);
    void transport.links().then((answer) => {
      if (!cancelled) setRead(answer);
    });
    return () => {
      cancelled = true;
    };
  }, [transport, attempt]);

  return (
    <div className="dbk dbk-list dbk-stack" data-theme={theme}>
      {heading && (
        <header>
          <h2 className="dbk-title">Book a time</h2>
        </header>
      )}
      {read === null ? (
        <p className="dbk-empty" aria-busy="true">
          Loading...
        </p>
      ) : read.status === "closed" ? (
        <p className="dbk-empty">{read.message}</p>
      ) : read.status === "unavailable" ? (
        <div className="dbk-empty">
          The calendar didn&apos;t answer. Try again in a minute.
          <button type="button" className="dbk-quiet" onClick={() => setAttempt((n) => n + 1)}>
            <ArrowClockwiseIcon />
            Try again
          </button>
        </div>
      ) : read.links.length === 0 ? (
        <p className="dbk-empty">Booking isn&apos;t open right now.</p>
      ) : (
        <ul className="dbk-link-cards">
          {linkGroups(read.links).map((group) => (
            <li key={group.slug}>
              <LinkCard group={group} href={linkHref?.(group.slug)} onPick={() => onPick(group.slug)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LinkCard({ group, href, onPick }: { group: LinkGroup; href: string | undefined; onPick: () => void }) {
  const body = (
    <>
      <span className="dbk-link-text">
        <span className="dbk-link-title">{group.title}</span>
        <span className="dbk-link-lengths">
          {group.lengths.map((length, index) => (
            <span key={length}>
              {index > 0 && " · "}
              <Suffixed text={lengthLabel(length)} />
            </span>
          ))}
        </span>
      </span>
      <CaretRightBoldIcon size={13} className="dbk-link-caret" />
    </>
  );
  return href ? (
    <a className="dbk-link-card" href={href}>
      {body}
    </a>
  ) : (
    <button type="button" className="dbk-link-card" onClick={onPick}>
      {body}
    </button>
  );
}
