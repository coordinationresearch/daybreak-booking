import { readFileSync } from "node:fs";

/**
 * A fake deployment that answers from Daybreak's own contract,
 * fixtures/booking-api/cases.json, which Daybreak's sync script copies in.
 */

export type Case = {
  name: string;
  given: string;
  unversioned?: boolean;
  request: { method: "GET" | "POST"; path: string; headers?: Record<string, string>; body?: unknown };
  response: { status: number; body: unknown };
};

export const CASES: Case[] = JSON.parse(
  readFileSync(new URL("../../fixtures/booking-api/cases.json", import.meta.url), "utf8"),
).cases;

export const DEPLOYMENT = "https://your-deployment.convex.site";
export const KEY = "dbk_example-booking-key";

export type Call = { url: string; method: string; headers: Headers; body: unknown };

/** A fetch that answers `cases` by method, path, and body, and records each call. Anything else throws, as a dropped connection does. */
export function fakeDeployment(cases: Case[] = CASES, extra?: (call: Call) => Response | undefined) {
  const calls: Call[] = [];
  const fetch = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    const call: Call = { url, method: init.method ?? "GET", headers: new Headers(init.headers), body };
    calls.push(call);
    const answered = extra?.(call);
    if (answered) return answered;
    const match = cases.find(
      (c) =>
        `${DEPLOYMENT}${c.request.path}` === url &&
        c.request.method === call.method &&
        JSON.stringify(c.request.body ?? null) === JSON.stringify(body ?? null) &&
        Object.entries(c.request.headers ?? {}).every(
          ([name, value]) => name === "X-Daybreak-Booking-Client" || call.headers.get(name) === value,
        ),
    );
    if (!match) throw new TypeError(`fetch failed: no case for ${call.method} ${url}`);
    return new Response(JSON.stringify(match.response.body), {
      status: match.response.status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { fetch: fetch as typeof globalThis.fetch, calls };
}

export function caseNamed(name: string): Case {
  const found = CASES.find((c) => c.name === name);
  if (!found) throw new Error(`No fixture case ${name}`);
  return found;
}
