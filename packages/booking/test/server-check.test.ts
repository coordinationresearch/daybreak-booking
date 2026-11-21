import { afterEach, describe, expect, it, vi } from "vitest";

import { bookingHandler, createClient } from "../src/index.js";

const URL = "https://your-deployment.convex.site";
const KEY = "dbk_example-booking-key";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("where the server side runs", () => {
  it("refuses in a web worker, where a key would be as public as on the page", () => {
    vi.stubGlobal("importScripts", () => undefined);
    expect(() => createClient({ url: URL, key: KEY })).toThrow(/only on a server/);
    expect(() => bookingHandler({ url: URL, key: KEY })).toThrow(/only on a server/);
  });

  it("runs where `window` exists without a document, as Deno 1 had", () => {
    vi.stubGlobal("window", {});
    expect(() => createClient({ url: URL, key: KEY })).not.toThrow();
  });
});

describe("its secrets", () => {
  it("throws without a key", () => {
    for (const key of [undefined, ""]) {
      expect(() => bookingHandler({ url: URL, key: key as string })).toThrow(/DAYBREAK_BOOKING_KEY/);
    }
  });

  it("throws for a Turnstile secret passed empty, and books without a check only when it's left out", () => {
    for (const turnstileSecret of [undefined, "", " "]) {
      expect(() => bookingHandler({ url: URL, key: KEY, turnstileSecret: turnstileSecret as string })).toThrow(
        /TURNSTILE_SECRET_KEY/,
      );
    }
    expect(() => bookingHandler({ url: URL, key: KEY })).not.toThrow();
  });
});
