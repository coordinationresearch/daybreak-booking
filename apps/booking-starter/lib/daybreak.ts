// The server's side of the starter: the deployment's address and the booking key come from the
// environment and stay here. Nothing in this file may be imported by a client component.
import { bookingHandler, createClient, type BookingClient } from "@coordination/booking";

type Env = { url: string; key: string; turnstileSecret: string | undefined; turnstileSiteKey: string | undefined };

export function env(): Env {
  return {
    url: process.env.DAYBREAK_URL?.trim() ?? "",
    key: process.env.DAYBREAK_BOOKING_KEY?.trim() ?? "",
    turnstileSecret: process.env.TURNSTILE_SECRET_KEY?.trim() || undefined,
    turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || undefined,
  };
}

/** The names of the required variables that aren't set. Never their values. */
export function missing(): string[] {
  const { url, key } = env();
  return [...(url ? [] : ["DAYBREAK_URL"]), ...(key ? [] : ["DAYBREAK_BOOKING_KEY"])];
}

/**
 * "on" with both Turnstile keys, "off" with neither. With only one, bookings break or go unchecked:
 * a secret without a site key refuses every booking, and a site key without a secret checks nothing.
 */
export function turnstile(): "on" | "off" | "half" {
  const { turnstileSecret, turnstileSiteKey } = env();
  if (turnstileSecret && turnstileSiteKey) return "on";
  return turnstileSecret || turnstileSiteKey ? "half" : "off";
}

let client: BookingClient | undefined;
let proxy: ((request: Request) => Promise<Response>) | undefined;

/** The deployment's client, made on first use so `next build` runs without the variables. Throws while they're missing. */
export function daybreak(): BookingClient {
  const { url, key } = env();
  client ??= createClient({ url, key });
  return client;
}

/** The proxy the page calls at /api/booking. Throws while the variables are missing. */
export function bookingProxy(): (request: Request) => Promise<Response> {
  const { url, key, turnstileSecret } = env();
  // Left out, not undefined: the handler throws on a turnstileSecret that's present but empty.
  proxy ??= bookingHandler({ url, key, ...(turnstileSecret ? { turnstileSecret } : {}) });
  return proxy;
}
