"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import { lengthLabel } from "../page/days.js";
import { type LengthChoice, type LinkGroup, lengthChoices, linkGroups, siblingsOf } from "../page/links.js";
import type { BookingPage, ListedLink } from "../types.js";
import { BookingPicker } from "./BookingPicker.js";
import { type LinksRead, type PageRead, createTransport } from "./data.js";
import { ArrowClockwiseIcon, CaretRightBoldIcon } from "./icons.js";
import { Suffixed } from "./text.js";
import { BOOKING_CSS } from "./styles.js";

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
  /** The link's first week, read on the server, so the page draws without waiting. */
  initial?: BookingPage;
  /** Cloudflare Turnstile's site key. With it, a booking carries `turnstileToken`, which the proxy checks. */
  turnstileSiteKey?: string;
  /** The link's title and its length and call, above the picker. On unless false. */
  heading?: boolean;
  /** "auto" (the default) follows the system's light or dark. */
  theme?: "auto" | "light" | "dark";
  /** Where each listed link goes. Without it, picking a link opens it in place. */
  linkHref?: (slug: string) => string;
  /** Adds the page's stylesheet to its document or shadow root. On unless false, for a site that loads `@coordination/booking/styles.css` itself. */
  injectStyles?: boolean;
  /** For tests, or a fetch that needs wrapping. */
  fetch?: typeof fetch;
  className?: string;
};

/**
 * A Daybreak booking page: a link's open time and a form to book it, or the
 * list of links. One component for React sites, `<daybreak-booking>`, and the
 * Daybreak site's `/u/` pages.
 */
export function DaybreakBooking(props: DaybreakBookingProps) {
  const { api, theme = "auto", injectStyles = true, className } = props;
  const root = useRef<HTMLDivElement>(null);
  const transport = useMemo(() => createTransport(api, props.fetch), [api, props.fetch]);
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const slug = props.slug ?? picked;

  useStyles(root, injectStyles);

  return (
    <div ref={root} className={["dbk", className].filter(Boolean).join(" ")} data-theme={theme === "auto" ? undefined : theme}>
      {slug ? (
        <LinkPage
          key={slug}
          slug={slug}
          transport={transport}
          initial={props.slug === slug ? props.initial : undefined}
          turnstileSiteKey={props.turnstileSiteKey}
          heading={props.heading ?? true}
          theme={theme}
          onBack={props.slug ? undefined : () => setPicked(undefined)}
        />
      ) : (
        <LinkList transport={transport} linkHref={props.linkHref} onPick={setPicked} heading={props.heading ?? true} />
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
  onBack,
}: {
  slug: string;
  transport: ReturnType<typeof createTransport>;
  initial: BookingPage | undefined;
  turnstileSiteKey: string | undefined;
  heading: boolean;
  theme: "auto" | "light" | "dark";
  onBack: (() => void) | undefined;
}) {
  const idPrefix = `dbk${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [read, setRead] = useState<PageRead | null>(initial ? { status: "open", page: initial } : null);
  const [attempt, setAttempt] = useState(0);
  const [siblings, setSiblings] = useState<ListedLink[]>([]);

  // The list says which links are this one's other lengths. Without it, the page offers the link's own.
  useEffect(() => {
    let cancelled = false;
    void transport.links().then((answer) => {
      if (!cancelled && answer.status === "open") setSiblings(siblingsOf(answer.links, slug));
    });
    return () => {
      cancelled = true;
    };
  }, [transport, slug]);

  useEffect(() => {
    if (initial && attempt === 0) return;
    let cancelled = false;
    setRead(null);
    // A second read follows a failure or a changed page, so it skips the CDN's copy.
    void transport.page(slug, undefined, { fresh: attempt > 0 }).then((answer) => {
      if (!cancelled) setRead(answer);
    });
    return () => {
      cancelled = true;
    };
  }, [transport, slug, initial, attempt]);

  const page = read?.status === "open" ? read.page : null;

  const choices: LengthChoice[] = page ? lengthChoices(page.link, siblings) : [];

  return (
    <div className="dbk-stack">
      {onBack && (
        <button type="button" className="dbk-back" onClick={onBack}>
          All links
        </button>
      )}
      {read === null ? (
        <p className="dbk-empty" aria-busy="true">
          Loading open times...
        </p>
      ) : read.status === "closed" ? (
        <p className="dbk-empty">{read.message}</p>
      ) : read.status === "unavailable" ? (
        <div className="dbk-empty">
          The calendar didn&apos;t answer. Try again in a minute.
          <button type="button" className="dbk-quiet dbk-quiet-sm" onClick={() => setAttempt((n) => n + 1)}>
            <ArrowClockwiseIcon />
            Try again
          </button>
        </div>
      ) : (
        <BookingPicker
          key={attempt}
          slug={slug}
          theme={theme}
          heading={heading}
          choices={choices}
          onReload={() => setAttempt((n) => n + 1)}
          initial={read.page}
          transport={transport}
          idPrefix={idPrefix}
          {...(turnstileSiteKey ? { turnstileSiteKey } : {})}
        />
      )}
    </div>
  );
}

function LinkList({
  transport,
  linkHref,
  onPick,
  heading,
}: {
  transport: ReturnType<typeof createTransport>;
  linkHref: ((slug: string) => string) | undefined;
  onPick: (slug: string) => void;
  heading: boolean;
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
    <div className="dbk-stack">
      {heading && (
        <header className="dbk-header">
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
          <button type="button" className="dbk-quiet dbk-quiet-sm" onClick={() => setAttempt((n) => n + 1)}>
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
