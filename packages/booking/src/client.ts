import {
  type BookingIndex,
  type BookingPage,
  type BookingRequest,
  type Booked,
  DAY_PATTERN,
} from "./types.js";

/**
 * A server-side client of a Daybreak deployment's Booking API (v1). It holds
 * a booking key, so it refuses to run in a browser: a key that reaches a
 * page is anyone's.
 */

export type ClientOptions = {
  /** The deployment's HTTP address, as `https://your-deployment.convex.site`. */
  url: string;
  /** A booking key from Settings › Booking › Website keys. Required: the client throws without one. */
  key: string;
  /** For tests, or a runtime whose global fetch needs wrapping. */
  fetch?: typeof fetch;
  /** How long a call waits for the deployment, 10 seconds unless given. */
  timeoutMs?: number;
};

export type CallOptions = {
  /** The address of the visitor the call is for, which the deployment's per-caller limit counts beside the key. */
  client?: string;
};

/** A refusal from the deployment, or `unavailable` when it didn't answer. */
export class BookingError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "BookingError";
    this.status = status;
    this.code = code;
  }
}

/** A raw answer: the status and the parsed body, or null when the body wasn't JSON. */
export type RawAnswer = { status: number; body: unknown };

export type BookingClient = {
  /** The listed links, how to book, and the API's version. */
  links(options?: CallOptions): Promise<BookingIndex>;
  /** A link's open time from `from` for `days` Days (7 unless given, at most 28). */
  page(slug: string, options?: CallOptions & { from?: string; days?: number }): Promise<BookingPage>;
  /** Books a time. Sending the same `requestId` again answers the first booking. */
  book(slug: string, booking: BookingRequest, options?: CallOptions): Promise<Booked>;
  /** Whether the key is live: false once it's revoked in Settings. */
  checkKey(): Promise<boolean>;
  /** One call, answered as it came, for a proxy that passes refusals through. */
  raw(method: "GET" | "POST", path: string, options?: CallOptions & { body?: unknown }): Promise<RawAnswer>;
};

export function assertServer(what: string): void {
  const inPage = typeof window !== "undefined" && typeof document !== "undefined";
  const inWorker = typeof (globalThis as { importScripts?: unknown }).importScripts === "function";
  if (inPage || inWorker) {
    throw new Error(
      `${what} holds a booking key and runs only on a server. In a browser, use @daybreak/booking/react or @daybreak/booking/element against your own proxy.`,
    );
  }
}

export function createClient(options: ClientOptions): BookingClient {
  assertServer("createClient");
  if (typeof options.key !== "string" || options.key.trim() === "") {
    throw new Error("createClient needs a booking key. Set DAYBREAK_BOOKING_KEY to one from Settings › Booking › Website keys.");
  }
  const key = options.key;
  const base = normalizeUrl(options.url);
  const send = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const timeoutMs = options.timeoutMs ?? 10_000;

  const raw: BookingClient["raw"] = async (method, path, call = {}) => {
    const headers: Record<string, string> = { Accept: "application/json" };
    headers["X-Daybreak-Booking-Key"] = key;
    if (call.client) headers["X-Daybreak-Booking-Client"] = call.client;
    if (call.body !== undefined) headers["Content-Type"] = "application/json";
    let response: Response;
    try {
      response = await send(`${base}${path}`, {
        method,
        headers,
        ...(call.body !== undefined ? { body: JSON.stringify(call.body) } : {}),
        // The key rides in a header, so a redirect must never carry it to another host.
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return { status: 0, body: null };
    }
    const body: unknown = await response.json().catch(() => null);
    return { status: response.status, body };
  };

  const expect = async <T>(answer: Promise<RawAnswer>, ok: (body: unknown) => body is T): Promise<T> => {
    const { status, body } = await answer;
    if (status >= 200 && status < 300 && ok(body)) return body;
    throw errorFrom(status, body);
  };

  return {
    raw,
    links: (call) => expect(raw("GET", "/book/v1", call), isObjectWith<BookingIndex>("links")),
    page: (slug, call = {}) => {
      if (call.from !== undefined && !DAY_PATTERN.test(call.from)) {
        return Promise.reject(new BookingError(400, "invalid", "`from` is a Day, YYYY-MM-DD"));
      }
      const query = new URLSearchParams();
      if (call.from) query.set("from", call.from);
      if (call.days !== undefined) query.set("days", String(call.days));
      const search = query.size > 0 ? `?${query}` : "";
      return expect(raw("GET", `/book/v1/${encodeURIComponent(slug)}${search}`, call), isObjectWith<BookingPage>("days"));
    },
    book: async (slug, booking, call = {}) => {
      const answer = await expect(
        raw("POST", `/book/v1/${encodeURIComponent(slug)}`, { ...call, body: booking }),
        isObjectWith<{ booked: Booked }>("booked"),
      );
      return answer.booked;
    },
    checkKey: async () => {
      const { status, body } = await raw("GET", "/book/v1/key");
      if (status === 200) return true;
      if (status === 401) return false;
      throw errorFrom(status, body);
    },
  };
}

/** The deployment's address without a trailing slash; only `https`, or `http` on a loopback address for a local backend. */
export function normalizeUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error("The deployment's url isn't an address. It looks like https://your-deployment.convex.site.");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) {
    throw new Error("The deployment's url must start with https://.");
  }
  return parsed.toString().replace(/\/+$/, "");
}

function isObjectWith<T>(field: string) {
  return (body: unknown): body is T => typeof body === "object" && body !== null && field in body;
}

/** The error a refusal's body names, or `unavailable` for anything unreadable. */
export function errorFrom(status: number, body: unknown): BookingError {
  const error =
    typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null
      ? (body.error as { code?: unknown; message?: unknown })
      : null;
  if (status >= 400 && error && typeof error.code === "string") {
    return new BookingError(status, error.code, typeof error.message === "string" ? error.message : error.code);
  }
  return new BookingError(status === 0 ? 502 : status, "unavailable", "The deployment didn't answer.");
}
