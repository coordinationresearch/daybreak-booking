import { afterEach, describe, expect, it, vi } from "vitest";

import { TURNSTILE_VERIFY_URL, bookingHandler, defaultClientAddress } from "../src/index.js";
import { CASES, DEPLOYMENT, KEY, caseNamed, fakeDeployment } from "./support/fake-deployment.js";

const SITE = "https://booking.example.com";
// Assembled at run time, as Daybreak's privacy scan asks of made-up secrets.
const TURNSTILE_SECRET = ["turnstile", "test", "secret"].join("-");

/** A handler behind a proxy that sets `x-real-ip` itself, which the tests stand in for. */
function handler(
  fetch: typeof globalThis.fetch,
  extra: { turnstileSecret?: string; basePath?: string; clientAddress?: (request: Request) => string | undefined } = {},
) {
  return bookingHandler({ url: DEPLOYMENT, key: KEY, fetch, clientAddress: (r) => r.headers.get("x-real-ip") ?? undefined, ...extra });
}

const JSON_TYPE = { "content-type": "application/json" };

/** The request a page sends the proxy for a fixture case's deployment request. */
function pageRequest(path: string, init: RequestInit & { ip?: string } = {}) {
  const deploymentUrl = new URL(`${DEPLOYMENT}${path}`);
  const rest = deploymentUrl.pathname.replace(/^\/book\/v1/, "");
  const headers = new Headers(init.headers);
  headers.set("x-real-ip", init.ip ?? "203.0.113.7");
  if (init.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
  return new Request(`${SITE}/api/booking${rest}${deploymentUrl.search}`, { ...init, headers });
}

async function expectNoDeploymentAddress(response: Response) {
  const text = await response.clone().text();
  expect(text).not.toContain("your-deployment");
  expect(text).not.toContain("convex.site");
  for (const [, value] of response.headers) expect(value).not.toContain("your-deployment");
}

describe("the proxy against Daybreak's fixtures", () => {
  // The key check and the host's photo aren't the page's reads or bookings, so the handler passes neither on.
  const routed = CASES.filter((c) => !["/book/v1/key", "/book/v1/photo.jpg"].includes(c.request.path));
  for (const c of routed) {
    it(`passes ${c.name} through`, async () => {
      const deployment = fakeDeployment();
      const response = await handler(deployment.fetch)(
        pageRequest(c.request.path, {
          method: c.request.method,
          ...(c.request.body ? { body: JSON.stringify(c.request.body) } : {}),
          ...(c.request.headers?.["X-Daybreak-Booking-Client"] ? { ip: c.request.headers["X-Daybreak-Booking-Client"] } : {}),
        }),
      );
      const body = c.response.body as Record<string, unknown>;
      expect(response.status).toBe(c.response.status);
      await expectNoDeploymentAddress(response);
      const answer = await response.json();
      if (c.request.path === "/book/v1") {
        expect(answer).toEqual({ links: body.links });
      } else {
        expect(answer).toEqual(body);
      }
      const [call] = deployment.calls;
      expect(call!.headers.get("X-Daybreak-Booking-Key")).toBe(KEY);
      expect(call!.headers.get("X-Daybreak-Booking-Client")).toBe(
        c.request.headers?.["X-Daybreak-Booking-Client"] ?? "203.0.113.7",
      );
    });
  }

  it("lists links without howToBook, which names the deployment's address", async () => {
    const response = await handler(fakeDeployment().fetch)(pageRequest("/book/v1"));
    expect(Object.keys(await response.json())).toEqual(["links"]);
  });

  it("lets a shared cache keep reads for a minute, and never bookings or refusals", async () => {
    const h = handler(fakeDeployment().fetch);
    const read = await h(pageRequest(caseNamed("page").request.path));
    expect(read.headers.get("Cache-Control")).toContain("s-maxage=60");
    const missing = await h(pageRequest(caseNamed("not_found").request.path));
    expect(missing.headers.get("Cache-Control")).toBe("no-store");
    const book = caseNamed("book");
    const booked = await h(pageRequest(book.request.path, { method: "POST", body: JSON.stringify(book.request.body) }));
    expect(booked.headers.get("Cache-Control")).toBe("no-store");
  });

  it("answers 502 unavailable when the deployment doesn't answer, without its error", async () => {
    const response = await handler(async () => {
      throw new TypeError(`fetch failed: ${DEPLOYMENT}`);
    })(pageRequest("/book/v1/meet"));
    expect(response.status).toBe(502);
    await expectNoDeploymentAddress(response);
    expect(await response.json()).toMatchObject({ error: { code: "unavailable" } });
  });

  it("answers 502 for a deployment error page", async () => {
    const response = await handler(async () => new Response(`<h1>${DEPLOYMENT} is down</h1>`, { status: 500 }))(
      pageRequest("/book/v1/meet"),
    );
    expect(response.status).toBe(502);
    await expectNoDeploymentAddress(response);
  });
});

describe("the proxy's own checks", () => {
  it("refuses a bad `from` or `days`, and a slug that can't be one, without calling", async () => {
    const deployment = fakeDeployment();
    const h = handler(deployment.fetch);
    expect((await h(new Request(`${SITE}/api/booking/meet?from=soon`))).status).toBe(400);
    expect((await h(new Request(`${SITE}/api/booking/meet?days=90`))).status).toBe(400);
    expect((await h(new Request(`${SITE}/api/booking/Not%20A%20Slug`))).status).toBe(404);
    expect((await h(new Request(`${SITE}/api/booking/meet/extra`))).status).toBe(404);
    expect((await h(new Request(`${SITE}/elsewhere`))).status).toBe(404);
    expect(deployment.calls).toHaveLength(0);
  });

  it("refuses other methods", async () => {
    const h = handler(fakeDeployment().fetch);
    const response = await h(new Request(`${SITE}/api/booking/meet`, { method: "DELETE" }));
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, POST");
  });

  it("refuses a body that isn't a JSON object", async () => {
    const h = handler(fakeDeployment().fetch);
    const post = (body: string) => h(new Request(`${SITE}/api/booking/meet`, { method: "POST", body, headers: JSON_TYPE }));
    expect((await post("not json")).status).toBe(400);
    expect((await post("[1]")).status).toBe(400);
    expect((await post(JSON.stringify({ about: "x".repeat(20_000) }))).status).toBe(400);
  });

  it("refuses 415 for a POST that isn't application/json, which another site's page could send without a preflight", async () => {
    const deployment = fakeDeployment();
    const h = handler(deployment.fetch);
    const body = JSON.stringify(caseNamed("book").request.body);
    for (const type of [undefined, "text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"]) {
      const response = await h(
        new Request(`${SITE}/api/booking/meet`, { method: "POST", body, headers: type ? { "content-type": type } : {} }),
      );
      expect(response.status).toBe(415);
      expect(await response.json()).toMatchObject({ error: { code: "invalid" } });
    }
    expect(deployment.calls).toHaveLength(0);
    const ok = await h(pageRequest("/book/v1/meet", { method: "POST", body, headers: { "content-type": "Application/JSON; charset=utf-8" } }));
    expect(ok.status).toBe(200);
  });

  it("refuses a Content-Length over 16 KB without reading the body", async () => {
    let pulled = false;
    const stream = new ReadableStream(
      {
        pull() {
          pulled = true;
          throw new Error("read");
        },
      },
      { highWaterMark: 0 },
    );
    const response = await handler(fakeDeployment().fetch)(
      new Request(`${SITE}/api/booking/meet`, {
        method: "POST",
        body: stream,
        headers: { ...JSON_TYPE, "content-length": "20000" },
        duplex: "half",
      } as RequestInit),
    );
    expect(response.status).toBe(400);
    expect(pulled).toBe(false);
  });

  it("counts the body's bytes, not its characters, and stops reading past 16 KB", async () => {
    // 9,000 characters, 18,000 bytes in UTF-8.
    const text = JSON.stringify({ about: "é".repeat(9_000) });
    expect(text.length).toBeLessThan(16_384);
    const bytes = new TextEncoder().encode(text);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          if (sent >= bytes.length) return controller.close();
          controller.enqueue(bytes.slice(sent, sent + 1_000));
          sent += 1_000;
        },
      },
      { highWaterMark: 0 },
    );
    const response = await handler(fakeDeployment().fetch)(
      new Request(`${SITE}/api/booking/meet`, { method: "POST", body: stream, headers: JSON_TYPE, duplex: "half" } as RequestInit),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { message: "The booking is too large." } });
    expect(sent).toBeLessThan(bytes.length);
  });

  it("drops the site's `registration` before forwarding the booking", async () => {
    const book = caseNamed("book");
    const deployment = fakeDeployment();
    const response = await handler(deployment.fetch)(
      pageRequest(book.request.path, {
        method: "POST",
        body: JSON.stringify({ ...(book.request.body as object), registration: "opaque-registration" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(deployment.calls[0]!.body).toEqual(book.request.body);
  });

  it("takes `days` written with a leading zero, which the page's fresh reads send", async () => {
    const deployment = fakeDeployment();
    const response = await handler(deployment.fetch)(pageRequest("/book/v1/meet?from=2026-10-09&days=02"));
    expect(response.status).toBe(200);
    expect(deployment.calls[0]!.url).toBe(`${DEPLOYMENT}/book/v1/meet?from=2026-10-09&days=2`);
  });

  it("calls upstream with redirects refused, so the key never follows one", async () => {
    const deployment = fakeDeployment();
    await handler(deployment.fetch)(pageRequest(caseNamed("page").request.path));
    expect(deployment.calls[0]!.init.redirect).toBe("error");
  });

  it("mounts anywhere", async () => {
    const h = handler(fakeDeployment().fetch, { basePath: "/book/" });
    const response = await h(new Request(`${SITE}/book`, { headers: { "x-real-ip": "203.0.113.7" } }));
    expect(response.status).toBe(200);
  });
});

describe("the person check", () => {
  const book = caseNamed("book");

  function withTurnstile(success: boolean | "down") {
    const turnstileCalls: URLSearchParams[] = [];
    const turnstileInits: RequestInit[] = [];
    const deployment = fakeDeployment(CASES, (call) => {
      if (call.url !== TURNSTILE_VERIFY_URL) return undefined;
      turnstileCalls.push(call.body as URLSearchParams);
      turnstileInits.push(call.init);
      if (success === "down") return new Response("", { status: 500 });
      return new Response(JSON.stringify({ success }), { status: 200 });
    });
    return { deployment, turnstileCalls, turnstileInits, h: handler(deployment.fetch, { turnstileSecret: TURNSTILE_SECRET }) };
  }

  const post = (body: unknown) =>
    pageRequest(book.request.path, { method: "POST", body: JSON.stringify(body), ip: "203.0.113.7" });

  it("checks the token with Cloudflare, then books without it", async () => {
    const { deployment, turnstileCalls, turnstileInits, h } = withTurnstile(true);
    const response = await h(post({ ...(book.request.body as object), turnstileToken: "token-from-widget" }));
    expect(response.status).toBe(200);
    expect(turnstileInits[0]!.redirect).toBe("error");
    expect(turnstileCalls[0]!.get("secret")).toBe(TURNSTILE_SECRET);
    expect(turnstileCalls[0]!.get("response")).toBe("token-from-widget");
    expect(turnstileCalls[0]!.get("remoteip")).toBe("203.0.113.7");
    const booking = deployment.calls.find((c) => c.method === "POST" && c.url.startsWith(DEPLOYMENT))!;
    expect(booking.body).toEqual(book.request.body);
  });

  it("answers 403 forbidden without a token or for one Cloudflare refuses, and never books", async () => {
    for (const [success, body] of [
      [true, book.request.body],
      [false, { ...(book.request.body as object), turnstileToken: "stale" }],
    ] as const) {
      const { deployment, h } = withTurnstile(success);
      const response = await h(post(body));
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: { code: "forbidden" } });
      expect(deployment.calls.some((c) => c.url.startsWith(DEPLOYMENT))).toBe(false);
    }
  });

  it("answers 502 when Cloudflare doesn't answer", async () => {
    const { h } = withTurnstile("down");
    const response = await h(post({ ...(book.request.body as object), turnstileToken: "token" }));
    expect(response.status).toBe(502);
  });
});

describe("the visitor's address", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const spoofed = () =>
    new Request(`${SITE}/api/booking`, {
      headers: {
        "x-real-ip": "198.51.100.1",
        "cf-connecting-ip": "198.51.100.2",
        "x-forwarded-for": "198.51.100.3, 10.0.0.1",
      },
    });

  it("reads nothing by default where no platform vouches for a header, since a visitor can set any of them", async () => {
    vi.stubEnv("VERCEL", "");
    expect(defaultClientAddress(spoofed())).toBeUndefined();
    const deployment = fakeDeployment();
    const h = bookingHandler({ url: DEPLOYMENT, key: KEY, fetch: deployment.fetch });
    expect((await h(spoofed())).status).toBe(200);
    expect(deployment.calls[0]!.headers.has("X-Daybreak-Booking-Client")).toBe(false);
  });

  it("reads cf-connecting-ip on Cloudflare Workers, and x-real-ip on Vercel", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
    expect(defaultClientAddress(spoofed())).toBe("198.51.100.2");
    vi.unstubAllGlobals();
    vi.stubEnv("VERCEL", "1");
    expect(defaultClientAddress(spoofed())).toBe("198.51.100.1");
  });

  it("takes the site's own reader, which also feeds Turnstile's remoteip", async () => {
    const turnstile: URLSearchParams[] = [];
    const deployment = fakeDeployment(CASES, (call) => {
      if (call.url !== TURNSTILE_VERIFY_URL) return undefined;
      turnstile.push(call.body as URLSearchParams);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });
    const h = bookingHandler({
      url: DEPLOYMENT,
      key: KEY,
      fetch: deployment.fetch,
      turnstileSecret: TURNSTILE_SECRET,
      clientAddress: (r) => r.headers.get("x-site-visitor") ?? undefined,
    });
    const book = caseNamed("book");
    const response = await h(
      new Request(`${SITE}/api/booking/meet`, {
        method: "POST",
        headers: { ...JSON_TYPE, "x-site-visitor": "203.0.113.7", "x-real-ip": "198.51.100.1" },
        body: JSON.stringify({ ...(book.request.body as object), turnstileToken: "token" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(turnstile[0]!.get("remoteip")).toBe("203.0.113.7");
    const booking = deployment.calls.find((c) => c.url.startsWith(DEPLOYMENT))!;
    expect(booking.headers.get("X-Daybreak-Booking-Client")).toBe("203.0.113.7");
  });
});
