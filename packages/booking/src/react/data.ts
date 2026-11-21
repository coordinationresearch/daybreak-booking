import { useCallback, useEffect, useRef, useState } from "react";

import { WEEK } from "../page/days.js";
import { type BookResult, MESSAGES, readBookingAnswer } from "../page/request.js";
import type { BookingPage, BookingRequest, ListedLink } from "../types.js";

/**
 * The page's calls to its proxy: `GET <api>`, `GET <api>/<slug>`, and
 * `POST <api>/<slug>`, which `bookingHandler`, the Daybreak site's
 * `/api/u/<name>`, and any proxy with the same shape answer. Never the
 * deployment itself: it has no CORS, and the proxy holds the key.
 */

export type PageRead =
  | { status: "open"; page: BookingPage }
  /** No such link, or the host isn't taking bookings. */
  | { status: "closed"; message: string }
  /** The proxy or the deployment didn't answer. */
  | { status: "unavailable" };

export type LinksRead = { status: "open"; links: ListedLink[] } | { status: "closed"; message: string } | { status: "unavailable" };

/** What a POST carries beside the booking: the person check's token, and the page's `registration` sent back. */
export type ProxyFields = { turnstileToken?: string; registration?: string };

export type Transport = {
  /** `fresh` skips a shared cache's copy, after a booking changed the open time. */
  page(slug: string, from: string | undefined, options?: { fresh?: boolean }): Promise<PageRead>;
  links(): Promise<LinksRead>;
  book(slug: string, request: BookingRequest & ProxyFields): Promise<BookResult>;
};

/**
 * `days` as a fresh read asks for it. A CDN keeps each read for a minute by
 * its address, so a read just after a booking asks for the same week as
 * `days=07`: an address the cache hasn't seen, which both `bookingHandler`
 * and the Daybreak site's proxy take (the site's refuses any parameter but
 * `from` and `days`, so a cache-busting parameter of its own isn't an option).
 */
export const FRESH_DAYS = `0${WEEK}`;

/**
 * The `registration` a page's body carries when the Daybreak site's proxy
 * answered it: an opaque value a booking sends back, so a page loaded for
 * one host never books with another. `bookingHandler` sends none.
 */
export function registrationOf(page: BookingPage | null | undefined): string | undefined {
  const value = (page as { registration?: unknown } | null | undefined)?.registration;
  return typeof value === "string" && value !== "" ? value : undefined;
}

const base = (api: string) => api.replace(/\/+$/, "");

function errorMessage(body: unknown): string | null {
  const error =
    typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error
      ? (body.error as { message?: unknown })
      : null;
  return typeof error?.message === "string" && error.message.trim() !== "" ? error.message : null;
}

export function createTransport(api: string, send: typeof fetch = (...args) => fetch(...args)): Transport {
  const read = async (url: string) => {
    try {
      const response = await send(url, { headers: { Accept: "application/json" } });
      return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
    } catch {
      return { status: 0, body: null };
    }
  };
  return {
    async page(slug, from, options = {}) {
      // `from` first, then `days`: the one order the Daybreak site's proxy answers without a redirect.
      const query = new URLSearchParams();
      if (from) query.set("from", from);
      query.set("days", options.fresh ? FRESH_DAYS : String(WEEK));
      const { status, body } = await read(`${base(api)}/${encodeURIComponent(slug)}?${query}`);
      if (status === 200 && typeof body === "object" && body !== null && "days" in body) {
        return { status: "open", page: body as BookingPage };
      }
      if (status === 404) return { status: "closed", message: errorMessage(body) ?? MESSAGES.notFound };
      if (status === 503) return { status: "closed", message: errorMessage(body) ?? MESSAGES.closed };
      return { status: "unavailable" };
    },
    async links() {
      const { status, body } = await read(base(api));
      if (status === 200 && typeof body === "object" && body !== null && "links" in body && Array.isArray(body.links)) {
        return { status: "open", links: body.links as ListedLink[] };
      }
      if (status === 404 || status === 503) return { status: "closed", message: errorMessage(body) ?? MESSAGES.closed };
      return { status: "unavailable" };
    },
    async book(slug, request) {
      try {
        const response = await send(`${base(api)}/${encodeURIComponent(slug)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(request),
        });
        const body: unknown = await response.json().catch(() => null);
        return readBookingAnswer(response.status, body);
      } catch {
        return { ok: false, code: "unavailable", message: MESSAGES.unavailable };
      }
    },
  };
}

/** How long a week's open time is shown without asking again. */
const FRESH_MS = 30_000;

/** How long a shared cache may keep a read: `bookingHandler`'s default and the site's. */
const CDN_MS = 60_000;

/**
 * One week of open time at a time, keeping the last week on screen while the
 * next loads, as react-query's `keepPreviousData` did on /meet. `invalidate`
 * forgets every week after a booking changes the open time.
 */
export function useWeek(transport: Transport, slug: string, from: string, initial: { from: string; page: BookingPage }) {
  const cache = useRef(new Map<string, { at: number; read: PageRead }>([[initial.from, { at: Date.now(), read: { status: "open", page: initial.page } }]]));
  const [shown, setShown] = useState<{ from: string; read: PageRead }>({
    from: initial.from,
    read: { status: "open", page: initial.page },
  });
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  // Until then, every read skips the CDN's copy, which may predate the booking.
  const freshUntil = useRef(0);

  useEffect(() => {
    const hit = cache.current.get(from);
    if (hit && Date.now() - hit.at < FRESH_MS) {
      setShown({ from, read: hit.read });
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void transport.page(slug, from, { fresh: Date.now() < freshUntil.current }).then((read) => {
      if (read.status === "open") cache.current.set(from, { at: Date.now(), read });
      if (cancelled) return;
      setShown({ from, read });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [transport, slug, from, version]);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);
  const invalidate = useCallback(() => {
    cache.current.clear();
    freshUntil.current = Date.now() + CDN_MS;
    setVersion((v) => v + 1);
  }, []);

  return { read: shown.read, isPlaceholder: shown.from !== from || loading, refetch, invalidate };
}
