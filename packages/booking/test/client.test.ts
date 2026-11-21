import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";

import { BookingError, createClient, normalizeUrl } from "../src/index.js";
import { CASES, DEPLOYMENT, KEY, caseNamed, fakeDeployment } from "./support/fake-deployment.js";

const client = (fetch: typeof globalThis.fetch, key: string | undefined = KEY) =>
  createClient({ url: `${DEPLOYMENT}/`, key: key ?? KEY, fetch });

/** Runs one fixture case through the client's matching method, answering its result or its error. */
async function run(name: string) {
  const c = caseNamed(name);
  const deployment = fakeDeployment();
  const key = c.request.headers?.["X-Daybreak-Booking-Key"];
  const api = client(deployment.fetch, key);
  const url = new URL(`${DEPLOYMENT}${c.request.path}`);
  const segments = url.pathname.split("/").slice(3);
  const clientAddress = c.request.headers?.["X-Daybreak-Booking-Client"];
  const call = clientAddress ? { client: clientAddress } : {};
  try {
    if (segments.length === 0) return { result: await api.links(call), deployment };
    if (segments[0] === "key") return { result: await api.checkKey(), deployment };
    const slug = segments[0]!;
    if (c.request.method === "GET") {
      const from = url.searchParams.get("from") ?? undefined;
      const days = url.searchParams.get("days");
      return {
        result: await api.page(slug, { ...call, ...(from ? { from } : {}), ...(days ? { days: Number(days) } : {}) }),
        deployment,
      };
    }
    return { result: await api.book(slug, c.request.body as never, call), deployment };
  } catch (error) {
    return { error: error as BookingError, deployment };
  }
}

describe("the client against Daybreak's fixtures", () => {
  for (const c of CASES) {
    it(`answers ${c.name} as the deployment does`, async () => {
      const { result, error } = await run(c.name);
      const body = c.response.body as Record<string, unknown>;
      if (c.name === "key") return expect(result).toBe(true);
      if (c.name === "unknown key") return expect(result).toBe(false);
      if (c.response.status === 200) {
        expect(error).toBeUndefined();
        expect(result).toEqual("booked" in body ? body.booked : body);
        return;
      }
      const expected = (body as { error: { code: string; message: string } }).error;
      expect(error).toBeInstanceOf(BookingError);
      expect(error).toMatchObject({ status: c.response.status, code: expected.code, message: expected.message });
    });
  }

  it("sends the key, and the visitor's address beside it", async () => {
    const { deployment } = await run("book");
    const [call] = deployment.calls;
    expect(call!.headers.get("X-Daybreak-Booking-Key")).toBe(KEY);
    expect(call!.headers.get("X-Daybreak-Booking-Client")).toBe("203.0.113.7");
    expect(call!.headers.get("Content-Type")).toBe("application/json");
  });

  it("throws at once without a key, rather than calling without one", () => {
    for (const key of [undefined, "", "  "]) {
      expect(() => createClient({ url: DEPLOYMENT, key: key as string })).toThrow(/DAYBREAK_BOOKING_KEY/);
    }
  });

  it("never follows a redirect, so the key can't reach another host", async () => {
    const seen: string[] = [];
    const elsewhere = createServer((request, response) => {
      seen.push(String(request.headers["x-daybreak-booking-key"]));
      response.end("{}");
    });
    const redirecting = createServer((_request, response) => {
      const { port } = elsewhere.address() as AddressInfo;
      response.writeHead(307, { Location: `http://127.0.0.1:${port}/book/v1` }).end();
    });
    await Promise.all([elsewhere, redirecting].map((s) => new Promise<void>((done) => s.listen(0, "127.0.0.1", done))));
    try {
      const { port } = redirecting.address() as AddressInfo;
      const api = createClient({ url: `http://127.0.0.1:${port}`, key: KEY });
      await expect(api.links()).rejects.toMatchObject({ code: "unavailable", status: 502 });
      expect(seen).toEqual([]);
    } finally {
      await Promise.all([elsewhere, redirecting].map((s) => new Promise((done) => s.close(done))));
    }
  });

  it("asks fetch to refuse redirects", async () => {
    const inits: RequestInit[] = [];
    await client(async (_input, init) => {
      inits.push(init ?? {});
      return new Response(JSON.stringify({ links: [] }), { status: 200 });
    }).links();
    expect(inits[0]!.redirect).toBe("error");
  });

  it("answers unavailable when the deployment doesn't answer", async () => {
    const api = client(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(api.links()).rejects.toMatchObject({ code: "unavailable", status: 502 });
  });

  it("answers unavailable for a body it can't read", async () => {
    const api = client(async () => new Response("<html>", { status: 500 }));
    await expect(api.page("meet")).rejects.toMatchObject({ code: "unavailable", status: 500 });
  });

  it("refuses a `from` that isn't a Day without calling", async () => {
    const deployment = fakeDeployment();
    await expect(client(deployment.fetch).page("meet", { from: "tomorrow" })).rejects.toMatchObject({ code: "invalid" });
    expect(deployment.calls).toHaveLength(0);
  });
});

describe("the deployment's address", () => {
  it("takes https, and http only on a loopback address", () => {
    expect(normalizeUrl("https://your-deployment.convex.site/")).toBe(DEPLOYMENT);
    expect(normalizeUrl("http://127.0.0.1:3411")).toBe("http://127.0.0.1:3411");
    expect(() => normalizeUrl("http://your-deployment.convex.site")).toThrow(/https/);
    expect(() => normalizeUrl("your-deployment")).toThrow(/address/);
  });
});
