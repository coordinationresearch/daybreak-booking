// @vitest-environment jsdom
// What the component adds around /meet's page (MeetBooking.test.tsx tests
// the page itself): the proxy's routes in place of /meet's tRPC calls, a
// link's own lengths alone, `registration`, a closed link, and the list.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "./support/jsdom-range.js";
import type * as Zones from "../src/page/zones.js";
import { zonedTime } from "../src/page/zones.js";
import { DaybreakBooking } from "../src/react/index.js";
import type { BookingPage } from "../src/types.js";

const PT = "America/Los_Angeles";
const at = (hour: number, minute = 0, day = "2026-11-10") => zonedTime(day, hour * 60 + minute, PT);

vi.mock("../src/page/zones.js", async (original) => ({
  ...(await original<typeof Zones>()),
  browserTimeZone: () => "America/New_York",
}));

const PAGE: BookingPage = {
  link: {
    slug: "meet",
    title: "Meet with Sam",
    host: "Sam",
    lengths: [15, 30, 60],
    defaultLength: 30,
    call: { kind: "meet" },
  },
  timeZone: PT,
  firstDay: "2026-11-10",
  lastDay: "2026-11-30",
  days: [
    {
      day: "2026-11-10",
      open: [
        { start: at(9), end: at(10) },
        { start: at(11), end: at(12) },
      ],
    },
    {
      day: "2026-11-11",
      open: [{ start: at(10, 0, "2026-11-11"), end: at(11, 0, "2026-11-11") }],
    },
  ],
  suggested: [at(11)],
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** The list the proxy answers at `GET <api>`, which the page reads for a link's other lengths. */
const LINKS = { links: [{ slug: "meet", title: "Meet with Sam", lengths: [15, 30, 60] }] };

/** The proxy: a page read answers the page, the list answers LINKS, POSTs answer what each test queues. */
function fakeProxy(pageBody: () => unknown = () => PAGE) {
  const posts: { url: string; body: Record<string, unknown> }[] = [];
  const gets: string[] = [];
  const answers: (Response | Error)[] = [];
  const fetch = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    if (init.method === "POST") {
      posts.push({ url, body: JSON.parse(String(init.body)) });
      const next = answers.shift();
      if (!next) throw new Error("unexpected POST");
      if (next instanceof Error) throw next;
      return next;
    }
    if (!url.includes("?")) return json(200, LINKS);
    gets.push(url);
    return json(200, pageBody());
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, posts, gets, answers };
}

const BOOKED = { booked: { start: at(11), end: at(11, 30), title: "Ana 🤝 Sam" } };

async function fillForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Name"), "Ana Lopez");
  await user.type(screen.getByLabelText("Email"), "ana@example.com");
  return user;
}

const book = (minutes = 30) => screen.getByRole("button", { name: `Book ${minutes} minutes` });

describe("booking a link through its proxy", () => {
  let proxy: ReturnType<typeof fakeProxy>;
  beforeEach(() => {
    proxy = fakeProxy();
  });
  afterEach(cleanup);

  it("reads the first four weeks itself, then draws /meet's page", async () => {
    render(<DaybreakBooking api="/api/u/sam/" slug="meet" fetch={proxy.fetch} />);
    expect(await screen.findByRole("heading", { name: "Meet with Sam" })).toBeTruthy();
    expect(proxy.gets[0]).toBe("/api/u/sam/meet?days=28");
  });

  it("draws without asking when given the first page", async () => {
    render(<DaybreakBooking api="/api/booking" slug="meet" initial={PAGE} fetch={proxy.fetch} />);
    expect(await screen.findByRole("heading", { name: "Meet with Sam" })).toBeTruthy();
    expect(proxy.gets).toEqual([]);
  });

  it("books with the proxy, and reads the Days again past the CDN's copy", async () => {
    proxy.answers.push(json(200, BOOKED));
    render(<DaybreakBooking api="/api/booking" slug="meet" initial={PAGE} fetch={proxy.fetch} />);
    await screen.findByRole("heading", { name: "Meet with Sam" });
    const user = await fillForm();
    await user.click(book());
    await waitFor(() => expect(proxy.posts).toHaveLength(1));
    expect(proxy.posts[0]!.url).toBe("/api/booking/meet");
    expect(proxy.posts[0]!.body).toMatchObject({ start: at(11), length: 30, name: "Ana Lopez", email: "ana@example.com" });
    expect("registration" in proxy.posts[0]!.body).toBe(false);
    // `days=028` is an address a CDN hasn't kept, so the read is the Days as they are now.
    await waitFor(() => expect(proxy.gets).toContain("/api/booking/meet?from=2026-11-10&days=028"));
  });

  it("offers only the link's own lengths, as /meet does, never a same-titled link's", async () => {
    const fetch = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = String(input);
      if (init.method === "POST") return json(200, BOOKED);
      if (!url.includes("?"))
        return json(200, {
          links: [
            { slug: "meet", title: "Meet with Sam", lengths: [30] },
            { slug: "60", title: "Meet with Sam", lengths: [60] },
          ],
        });
      return json(200, { ...PAGE, link: { ...PAGE.link, lengths: [30] } });
    });
    render(<DaybreakBooking api="/api/booking" slug="meet" fetch={fetch as unknown as typeof globalThis.fetch} />);
    await screen.findByRole("heading", { name: "Meet with Sam" });
    expect(screen.queryByRole("button", { name: "60 minutes" })).toBeNull();
    // The page never reads the list, which only grouped a link's siblings.
    expect(fetch.mock.calls.map(([input]) => String(input))).not.toContain("/api/booking");
    const user = await fillForm();
    await user.click(book());
    await waitFor(() => expect(fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    const post = fetch.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(String(post[0])).toBe("/api/booking/meet");
  });

  it("sends back the `registration` the site's proxy put on the page, and the new one after a `changed`", async () => {
    let registration = "old-registration";
    proxy = fakeProxy(() => ({ ...PAGE, registration }));
    const message = "This booking page changed. Reload it to see current times.";
    proxy.answers.push(json(409, { error: { code: "changed", message } }));
    render(<DaybreakBooking api="/api/u/sam" slug="meet" fetch={proxy.fetch} />);
    await screen.findByRole("heading", { name: "Meet with Sam" });
    const user = await fillForm();
    registration = "new-registration";
    await user.click(book());
    await waitFor(() => expect(proxy.posts).toHaveLength(1));
    expect(proxy.posts[0]!.body.registration).toBe("old-registration");
    expect(await screen.findByText(message)).toBeTruthy();
    await waitFor(() => expect(proxy.gets).toContain("/api/u/sam/meet?from=2026-11-10&days=028"));

    proxy.answers.push(json(200, BOOKED));
    await user.click(book());
    await waitFor(() => expect(proxy.posts).toHaveLength(2));
    expect(proxy.posts[1]!.body.registration).toBe("new-registration");
  });

  it("says a closed link is closed, in the proxy's words", async () => {
    const fetch = (async () =>
      json(404, { error: { code: "not_found", message: "This booking page isn't taking bookings." } })) as typeof globalThis.fetch;
    render(<DaybreakBooking api="/api/u/sam" slug="meet" fetch={fetch} />);
    expect(await screen.findByText("This booking page isn't taking bookings.")).toBeTruthy();
  });

  it("draws Cloudflare's widget with the site key", async () => {
    const renderWidget = vi.fn(() => "widget-1");
    window.turnstile = { render: renderWidget, reset: vi.fn(), remove: vi.fn() };
    try {
      render(<DaybreakBooking api="/api/booking" slug="meet" initial={PAGE} turnstileSiteKey="example-site-key" fetch={proxy.fetch} />);
      await waitFor(() => expect(renderWidget).toHaveBeenCalled());
      expect(renderWidget.mock.calls[0]!.at(1)).toMatchObject({ sitekey: "example-site-key" });
    } finally {
      delete window.turnstile;
    }
  });
});

describe("the list of links", () => {
  afterEach(cleanup);

  const links = {
    links: [
      { slug: "meet", title: "Meet with Sam", lengths: [30] },
      { slug: "15", title: "Meet with Sam", lengths: [15] },
      { slug: "office-hours", title: "Office hours", lengths: [20] },
    ],
  };

  it("shows one card per title, linked where linkHref says", async () => {
    const fetch = (async () => json(200, links)) as typeof globalThis.fetch;
    render(<DaybreakBooking api="/api/u/sam" fetch={fetch} linkHref={(slug) => `/u/sam/${slug}`} />);
    const link = await screen.findByRole("link", { name: /Meet with Sam/ });
    expect(link.getAttribute("href")).toBe("/u/sam/meet");
    expect(link.textContent).toContain("15m · 30m");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("opens a link in place without linkHref", async () => {
    const fetch = (async (input: string | URL | Request) =>
      json(200, String(input) === "/api/u/sam" ? links : PAGE)) as typeof globalThis.fetch;
    render(<DaybreakBooking api="/api/u/sam" fetch={fetch} />);
    fireEvent.click(await screen.findByRole("button", { name: /Meet with Sam/ }));
    expect(await screen.findByRole("heading", { name: "Meet with Sam" })).toBeTruthy();
  });
});
