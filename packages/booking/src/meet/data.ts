"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import type { BookResult } from "~/lib/booking/request";

import type { PageRead, ProxyFields, Transport } from "../react/data";
import type { BookingPage, BookingRequest } from "../types";

/**
 * The page's reads and its booking, in place of /meet's tRPC calls
 * (`api.useQueries` over `booking.page`, `api.booking.book.useMutation`),
 * with what of react-query's behaviour the page relies on: a read is fresh
 * for 30 seconds, a stale one is read again when the window comes back into
 * focus, a read in flight keeps what it held on screen, and `invalidate`
 * reads every block again.
 */

/** The transport, the slug each length books with, and `registration`, from the element or the React component. */
export type MeetData = {
  transport: Transport;
  /** The link that books `length`: the page's own, or a same-titled sibling's (links.ts). */
  slugFor: (length: number) => string;
};

export const MeetDataContext = createContext<MeetData | null>(null);

function useMeetData(): MeetData {
  const data = useContext(MeetDataContext);
  if (!data) throw new Error("The booking page needs its transport.");
  return data;
}

/** As the page's staleTime on /meet. */
const STALE_MS = 30_000;

/** How long a shared cache may keep a read, `bookingHandler`'s default and the site's. */
const CDN_MS = 60_000;

type Entry = { read?: PageRead; at: number; loading: boolean };

export type PageQuery = { data: PageRead | undefined; isError: boolean; refetch: () => void };

/** One read per block start in `froms`, with the first block given. */
export function usePageReads(slug: string, froms: string[], initial: { from: string; page: BookingPage }) {
  const { transport } = useMeetData();
  const entries = useRef(
    new Map<string, Entry>([[initial.from, { read: { status: "open", page: initial.page }, at: Date.now(), loading: false }]]),
  );
  const [, rerender] = useState(0);
  // Until then, every read skips the CDN's copy, which may predate a booking.
  const freshUntil = useRef(0);

  const fetchBlock = useCallback(
    (from: string) => {
      const entry = entries.current.get(from) ?? { at: 0, loading: false };
      if (entry.loading) return;
      entries.current.set(from, { ...entry, loading: true });
      void transport.page(slug, from, { fresh: Date.now() < freshUntil.current }).then((read) => {
        entries.current.set(from, { read, at: Date.now(), loading: false });
        rerender((n) => n + 1);
      });
    },
    [transport, slug],
  );

  const key = froms.join(" ");
  useEffect(() => {
    for (const from of key.split(" ")) {
      const entry = entries.current.get(from);
      if (!entry || (!entry.loading && Date.now() - entry.at > STALE_MS)) fetchBlock(from);
    }
  }, [key, fetchBlock]);

  const shownRef = useRef(froms);
  shownRef.current = froms;
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "hidden") return;
      for (const from of shownRef.current) {
        const entry = entries.current.get(from);
        if (entry && !entry.loading && Date.now() - entry.at > STALE_MS) fetchBlock(from);
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [fetchBlock]);

  const invalidate = useCallback(() => {
    freshUntil.current = Date.now() + CDN_MS;
    for (const [from, entry] of entries.current) entries.current.set(from, { ...entry, at: 0 });
    for (const from of shownRef.current) fetchBlock(from);
  }, [fetchBlock]);

  const reads: PageQuery[] = froms.map((from) => ({
    data: entries.current.get(from)?.read,
    isError: false,
    refetch: () => fetchBlock(from),
  }));
  return { reads, invalidate };
}

/** `registration` from the first read, sent back with a booking (the Daybreak site's proxy). */
function registrationOf(page: BookingPage): string | undefined {
  const value = (page as { registration?: unknown }).registration;
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * The booking, as /meet's `api.booking.book.useMutation()`: `mutateAsync`
 * and `isPending`. A `changed` answer (the site's proxy: the name now
 * answers from another deployment) reads the page again past the CDN, so
 * the next press sends the `registration` it has now.
 */
export function useBook(initial: BookingPage) {
  const { transport, slugFor } = useMeetData();
  const [isPending, setPending] = useState(false);
  const registration = useRef(registrationOf(initial));
  const mutateAsync = async (
    input: BookingRequest & { slug: string; turnstileToken?: string },
  ): Promise<BookResult> => {
    const { slug, ...request } = input;
    const sent = registration.current;
    const body: BookingRequest & ProxyFields = { ...request, ...(sent ? { registration: sent } : {}) };
    setPending(true);
    try {
      const answer = await transport.book(slugFor(input.length), body);
      if (!answer.ok && answer.code === "changed") {
        void transport.page(slug, initial.firstDay, { fresh: true }).then((read) => {
          if (read.status === "open") registration.current = registrationOf(read.page);
        });
      }
      return answer;
    } finally {
      setPending(false);
    }
  };
  return { mutateAsync, isPending };
}
