import { describe, expect, it } from "vitest";

import { TURNSTILE_VERIFY_URL, bookingHandler, clientAddress } from "../src/index.js";
import { CASES, DEPLOYMENT, KEY, caseNamed, fakeDeployment } from "./support/fake-deployment.js";

const SITE = "https://booking.example.com";
// Assembled at run time, as Daybreak's privacy scan asks of made-up secrets.
const TURNSTILE_SECRET = ["turnstile", "test", "secret"].join("-");

function handler(fetch: typeof globalThis.fetch, extra: { turnstileSecret?: string; basePath?: string } = {}) {
  return bookingHandler({ url: DEPLOYMENT, key: KEY, fetch, ...extra });
}

/** The request a page sends the proxy for a fixture case's deployment request. */
function pageRequest(path: string, init: RequestInit & { ip?: string } = {}) {
  const deploymentUrl = new URL(`${DEPLOYMENT}${path}`);
  const rest = deploymentUrl.pathname.replace(/^\/book\/v1/, "");
  const headers = new Headers(init.headers);
  headers.set("x-real-ip", init.ip ?? "203.0.113.7");
  return new Request(`${SITE}/api/booking${rest}${deploymentUrl.search}`, { ...init, headers });
}

async function expectNoDeploymentAddress(response: Response) {
  const text = await response.clone().text();
  expect(text).not.toContain("your-deployment");
  expect(text).not.toContain("convex.site");
  for (const [, value] of response.headers) expect(value).not.toContain("your-deployment");
}

describe("the proxy against Daybreak's fixtures", () => {
  const routed = CASES.filter((c) => !c.request.path.startsWith("/book/v1/key"));
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
    const post = (body: string) => h(new Request(`${SITE}/api/booking/meet`, { method: "POST", body }));
    expect((await post("not json")).status).toBe(400);
    expect((await post("[1]")).status).toBe(400);
    expect((await post(JSON.stringify({ about: "x".repeat(20_000) }))).status).toBe(400);
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
    const deployment = fakeDeployment(CASES, (call) => {
      if (call.url !== TURNSTILE_VERIFY_URL) return undefined;
      turnstileCalls.push(call.body as URLSearchParams);
      if (success === "down") return new Response("", { status: 500 });
      return new Response(JSON.stringify({ success }), { status: 200 });
    });
    return { deployment, turnstileCalls, h: handler(deployment.fetch, { turnstileSecret: TURNSTILE_SECRET }) };
  }

  const post = (body: unknown) =>
    pageRequest(book.request.path, { method: "POST", body: JSON.stringify(body), ip: "203.0.113.7" });

  it("checks the token with Cloudflare, then books without it", async () => {
    const { deployment, turnstileCalls, h } = withTurnstile(true);
    const response = await h(post({ ...(book.request.body as object), turnstileToken: "token-from-widget" }));
    expect(response.status).toBe(200);
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
  it("reads x-real-ip, then cf-connecting-ip, then x-forwarded-for's first entry", () => {
    expect(clientAddress(new Headers({ "x-real-ip": "198.51.100.1", "x-forwarded-for": "198.51.100.9" }))).toBe(
      "198.51.100.1",
    );
    expect(clientAddress(new Headers({ "cf-connecting-ip": "198.51.100.2", "x-forwarded-for": "198.51.100.9" }))).toBe(
      "198.51.100.2",
    );
    expect(clientAddress(new Headers({ "x-forwarded-for": "198.51.100.3, 10.0.0.1" }))).toBe("198.51.100.3");
    expect(clientAddress(new Headers())).toBeUndefined();
  });
});
