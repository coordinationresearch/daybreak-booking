import { type RawAnswer, assertServer, createClient } from "./client.js";
import { DAY_PATTERN, SLUG_PATTERN } from "./types.js";

/**
 * The proxy a booking page calls: a `(Request) => Response` that any
 * framework with web Requests can mount (Next.js route handlers, Astro,
 * Hono, Cloudflare Workers, Deno, Bun). It holds the booking key, checks
 * the person check when it has a Turnstile secret, and forwards the
 * visitor's address so the deployment's per-caller limit counts each
 * visitor apart. The deployment's address never reaches a response.
 *
 * Routes, under `basePath` (`/api/booking` unless given):
 * - `GET  <basePath>` answers `{ links }`, the listed links.
 * - `GET  <basePath>/<slug>?from=YYYY-MM-DD&days=7` answers the link's page.
 * - `POST <basePath>/<slug>` takes the booking as `application/json`, plus
 *   `turnstileToken` when the handler has a Turnstile secret, and answers
 *   `{ booked }`. It drops `turnstileToken` and `registration` (which the
 *   Daybreak site's proxy reads and this one doesn't) before forwarding.
 * Refusals answer `{ error: { code, message } }`: the deployment's own, or
 * 403 `forbidden` for a failed person check, 415 `invalid` for a body that
 * isn't JSON, and 502 `unavailable` when the deployment didn't answer.
 */

export type HandlerOptions = {
  /** The deployment's HTTP address, as `https://your-deployment.convex.site`. */
  url: string;
  /** A booking key from Settings › Booking › Website keys. Required: the handler throws without one. */
  key: string;
  /**
   * Cloudflare Turnstile's secret key. With it, a booking needs a `turnstileToken` that Cloudflare accepts.
   * Leave the option out to book without a person check; passing it empty throws, so a missing
   * environment variable doesn't turn the check off without a word.
   */
  turnstileSecret?: string;
  /**
   * The visitor's address, which the deployment's per-sender limit counts and Turnstile's check reads.
   * Unless given, `defaultClientAddress`: `cf-connecting-ip` on Cloudflare Workers, `x-real-ip` on
   * Vercel, and nothing elsewhere, since anywhere else a visitor can set those headers themselves.
   * Return undefined when you can't tell; every visitor then shares the key's limit.
   */
  clientAddress?: (request: Request) => string | undefined;
  /** Where the handler is mounted, `/api/booking` unless given. */
  basePath?: string;
  /** How long a shared cache may keep a read, in seconds, 60 unless given. 0 sends `no-store`. */
  cacheSeconds?: number;
  /** For tests, or a runtime whose global fetch needs wrapping. */
  fetch?: typeof fetch;
};

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** The largest booking body the handler reads, in bytes. */
const MOST_BODY = 16_384;

export function bookingHandler(options: HandlerOptions): (request: Request) => Promise<Response> {
  assertServer("bookingHandler");
  if (typeof options.key !== "string" || options.key.trim() === "") {
    throw new Error("bookingHandler needs a booking key. Set DAYBREAK_BOOKING_KEY to one from Settings › Booking › Website keys.");
  }
  if ("turnstileSecret" in options && (typeof options.turnstileSecret !== "string" || options.turnstileSecret.trim() === "")) {
    throw new Error(
      "bookingHandler's turnstileSecret is empty. Set TURNSTILE_SECRET_KEY, or leave the option out to book without a person check.",
    );
  }
  const client = createClient({ url: options.url, key: options.key, ...(options.fetch ? { fetch: options.fetch } : {}) });
  const send = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const addressOf = options.clientAddress ?? defaultClientAddress;
  const base = `/${(options.basePath ?? "/api/booking").replace(/^\/+|\/+$/g, "")}`.replace(/^\/$/, "");
  const cacheSeconds = options.cacheSeconds ?? 60;
  const readCache =
    cacheSeconds > 0 ? `public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds}` : "no-store";

  return async (request) => {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    if (path !== base && !path.startsWith(`${base}/`)) return refuse(404, "not_found", "No such route.");
    const rest = path.slice(base.length + 1);
    if (rest.includes("/")) return refuse(404, "not_found", "No such route.");
    const visitor = cleanAddress(addressOf(request));

    if (rest === "") {
      if (request.method !== "GET") return refuse(405, "invalid", "Use GET.", { Allow: "GET" });
      const answer = await client.raw("GET", "/book/v1", visitor ? { client: visitor } : {});
      if (answer.status === 200 && isObject(answer.body) && Array.isArray(answer.body.links)) {
        return json(200, { links: answer.body.links }, readCache);
      }
      return passRefusal(answer);
    }

    let slug: string;
    try {
      slug = decodeURIComponent(rest);
    } catch {
      return refuse(404, "not_found", "No such Booking link.");
    }
    if (!SLUG_PATTERN.test(slug)) return refuse(404, "not_found", "No such Booking link.");

    if (request.method === "GET") {
      const query = new URLSearchParams();
      const from = url.searchParams.get("from");
      const days = url.searchParams.get("days");
      if (from !== null) {
        if (!DAY_PATTERN.test(from)) return refuse(400, "invalid", "`from` is a Day, YYYY-MM-DD.");
        query.set("from", from);
      }
      if (days !== null) {
        const count = Number(days);
        if (!Number.isInteger(count) || count < 1 || count > 28) return refuse(400, "invalid", "`days` is 1 to 28.");
        query.set("days", String(count));
      }
      const search = query.size > 0 ? `?${query}` : "";
      const answer = await client.raw("GET", `/book/v1/${encodeURIComponent(slug)}${search}`, visitor ? { client: visitor } : {});
      if (answer.status === 200 && isObject(answer.body) && Array.isArray(answer.body.days)) {
        return json(200, answer.body, readCache);
      }
      return passRefusal(answer);
    }

    if (request.method !== "POST") return refuse(405, "invalid", "Use GET or POST.", { Allow: "GET, POST" });

    // A form or text/plain POST is one a page on another site can send without a preflight.
    const type = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (type !== "application/json") return refuse(415, "invalid", "Send the booking as application/json.");
    const length = request.headers.get("content-length");
    if (length !== null && !(Number(length) <= MOST_BODY)) return refuse(400, "invalid", "The booking is too large.");
    const text = await readCapped(request, MOST_BODY);
    if (text === "too_large") return refuse(400, "invalid", "The booking is too large.");
    if (text === null) return refuse(400, "invalid", "Send the booking as JSON.");
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return refuse(400, "invalid", "Send the booking as JSON.");
    }
    if (!isObject(body) || Array.isArray(body)) return refuse(400, "invalid", "Send the booking as a JSON object.");
    const { turnstileToken, registration: _registration, ...booking } = body;

    if (options.turnstileSecret) {
      const check = await verifyTurnstile(send, options.turnstileSecret, turnstileToken, visitor);
      if (check === "refused") {
        return refuse(403, "forbidden", "The check that you're a person didn't go through. Try it again.");
      }
      if (check === "unavailable") return refuse(502, "unavailable", "Couldn't check that you're a person. Try again.");
    }

    const answer = await client.raw("POST", `/book/v1/${encodeURIComponent(slug)}`, {
      body: booking,
      ...(visitor ? { client: visitor } : {}),
    });
    if (answer.status === 200 && isObject(answer.body) && isObject(answer.body.booked)) {
      return json(200, { booked: answer.body.booked }, "no-store");
    }
    return passRefusal(answer);
  };
}

/**
 * The visitor's address where the platform vouches for it: `cf-connecting-ip`
 * on Cloudflare Workers and `x-real-ip` on Vercel, each of which the platform
 * sets itself, overwriting any the visitor sent. Anywhere else nothing, since
 * a visitor who sets those headers, or `x-forwarded-for`, would look like a
 * new sender on every request. Pass `clientAddress` to read your own proxy's.
 */
export function defaultClientAddress(request: Request): string | undefined {
  if (onCloudflareWorkers()) return request.headers.get("cf-connecting-ip") ?? undefined;
  if (onVercel()) return request.headers.get("x-real-ip") ?? undefined;
  return undefined;
}

function onCloudflareWorkers(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

function onVercel(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return Boolean(env?.VERCEL);
}

/** An address as one header value: trimmed, at most 64 characters, or undefined. */
function cleanAddress(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length <= 64 && !/[\s,]/.test(trimmed) ? trimmed : undefined;
}

/** The body as text, read no further than `cap` bytes: `too_large` past it, null when it can't be read. */
async function readCapped(request: Request, cap: number): Promise<string | "too_large" | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > cap) {
        await reader.cancel().catch(() => undefined);
        return "too_large";
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

async function verifyTurnstile(
  send: typeof fetch,
  secret: string,
  token: unknown,
  remoteIp: string | undefined,
): Promise<"ok" | "refused" | "unavailable"> {
  if (typeof token !== "string" || token === "" || token.length > 2048) return "refused";
  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp) form.set("remoteip", remoteIp);
  try {
    const response = await send(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: form,
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return "unavailable";
    const answer = (await response.json()) as { success?: unknown };
    return answer.success === true ? "ok" : "refused";
  } catch {
    return "unavailable";
  }
}

/** The deployment's refusal, rebuilt from its code and message alone, or 502 `unavailable` for anything else. */
function passRefusal({ status, body }: RawAnswer): Response {
  const error = isObject(body) && isObject(body.error) ? body.error : null;
  if (status >= 400 && status < 500 && error && typeof error.code === "string") {
    const message = typeof error.message === "string" ? error.message : error.code;
    return refuse(status, error.code, message);
  }
  if (status === 503 && error && typeof error.code === "string") {
    return refuse(503, error.code, typeof error.message === "string" ? error.message : error.code);
  }
  return refuse(502, "unavailable", "The calendar didn't answer. Try again in a minute.");
}

function refuse(status: number, code: string, message: string, headers: Record<string, string> = {}): Response {
  return json(status, { error: { code, message } }, "no-store", headers);
}

function json(status: number, body: unknown, cacheControl: string, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cacheControl, ...headers },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
