// @vitest-environment jsdom
// Ported from the page this one was extracted from, with its tRPC calls
// replaced by the proxy's routes.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MESSAGES, REQUEST_ID } from "../src/page/request.js";
import type * as Zones from "../src/page/zones.js";
import { zonedTime } from "../src/page/zones.js";
import { WeekStrip } from "../src/react/WeekStrip.js";
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

async function fillForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Name"), "Ana de Lima");
  await user.type(screen.getByLabelText("Email"), "ana@example.com");
  await user.type(screen.getByLabelText(/What it's about/), "Planning");
  return user;
}

/** The card's time, as the booker reads it. */
const cardTime = () => document.querySelector(".dbk-aside .dbk-when-time")?.textContent;

describe("booking a link", () => {
  let proxy: ReturnType<typeof fakeProxy>;
  beforeEach(() => {
    proxy = fakeProxy();
  });
  afterEach(cleanup);

  const page = () => render(<DaybreakBooking api="/api/booking" slug="meet" initial={PAGE} fetch={proxy.fetch} />);

  it("starts on the best time, in both zones, with its Best badge", () => {
    page();
    expect(document.querySelector(".dbk-aside .dbk-when-day")?.textContent).toContain("Tue, Nov 10th");
    expect(cardTime()).toBe("2:00-2:30p ET");
    expect(document.querySelector(".dbk-aside .dbk-when-host")?.textContent).toBe("11:00-11:30a PT for Sam");
    expect(screen.getByText("Best")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Book 30m" })).toBeTruthy();
  });

  it("titles the page with its length and call, and draws without asking when given the first week", () => {
    page();
    expect(screen.getByRole("heading", { name: "Meet with Sam" })).toBeTruthy();
    expect(document.querySelector(".dbk-facts")?.textContent).toBe("30m · Google Meet");
    expect(proxy.gets).toEqual([]);
  });

  it("offers a way back to the best time after moving off it", () => {
    page();
    const grid = screen.getByRole("group", { name: "Open times" });
    fireEvent.keyDown(grid, { key: "Home" });
    expect(cardTime()).toBe("12:00-12:30p ET");
    fireEvent.click(screen.getByRole("button", { name: "Back to a best time for Sam" }));
    expect(cardTime()).toBe("2:00-2:30p ET");
  });

  it("resizes the selection when the length changes", () => {
    page();
    const grid = screen.getByRole("group", { name: "Open times" });
    fireEvent.keyDown(grid, { key: "Home" });
    fireEvent.keyDown(grid, { key: "ArrowDown" });
    expect(cardTime()).toBe("12:30-1:00p ET");
    fireEvent.click(screen.getByRole("button", { name: "60 minutes" }));
    // 9:30 PT can't hold an hour before 10, so the meeting slides to 9:00.
    expect(screen.getByRole("button", { name: "Book 60m" })).toBeTruthy();
    expect(cardTime()).toBe("12:00-1:00p ET");
  });

  it("asks for another time when the slot was just taken", async () => {
    proxy.answers.push(json(409, { error: { code: "taken", message: "That time was just taken. Pick another." } }));
    page();
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Book 30m" }));
    expect((await screen.findByRole("alert")).textContent).toBe(MESSAGES.taken);
    expect(screen.getByRole("button", { name: "Pick a time first" })).toBeTruthy();
    // The week is read again, since its open time changed.
    await waitFor(() => expect(proxy.gets.length).toBeGreaterThan(0));
    // `days=07` is an address a CDN hasn't kept, so the read is the week as it is now.
    expect(proxy.gets[0]).toBe("/api/booking/meet?from=2026-11-10&days=07");
  });

  it("says when the person check failed", async () => {
    proxy.answers.push(json(403, { error: { code: "forbidden", message: "No." } }));
    page();
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Book 30m" }));
    expect((await screen.findByRole("alert")).textContent).toBe(MESSAGES.challenge);
  });

  it("retries a dropped request with the same request ID, then confirms", async () => {
    proxy.answers.push(
      new TypeError("network"),
      json(200, { booked: { start: at(11), end: at(11, 30), title: "Ana 🤝 Sam" } }),
    );
    page();
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Book 30m" }));
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    await waitFor(() => expect(proxy.posts).toHaveLength(2));
    const [first, second] = proxy.posts.map((post) => post.body.requestId as string);
    expect(first).toMatch(REQUEST_ID);
    expect(second).toBe(first);
    expect(proxy.posts[0]!.url).toBe("/api/booking/meet");
    expect(proxy.posts[0]!.body).toMatchObject({
      start: at(11),
      length: 30,
      name: "Ana de Lima",
      email: "ana@example.com",
      about: "Planning",
    });

    const heading = await screen.findByRole("heading", { name: "You're meeting Sam" });
    expect(document.activeElement).toBe(heading);
    expect(document.querySelector(".dbk-done .dbk-when-time")?.textContent).toBe("2:00-2:30p ET");
    expect(screen.getByText(/PT for Sam/).textContent).toBe("11:00-11:30a PT for Sam");
    expect(screen.getByText("ana@example.com")).toBeTruthy();
    expect(document.body.textContent).toContain("with the Google Meet link");
  });

  it("sends guests, a phone, LinkedIn, and the meeting's name with the booking", async () => {
    proxy.answers.push(json(200, { booked: { start: at(11), end: at(11, 30), title: "Garden plans 🤝 Sam" } }));
    page();
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Add guests" }));
    await user.type(screen.getByLabelText("Guest 1's name"), "Ben Okafor");
    await user.type(screen.getByLabelText("Guest 1's email"), "ben@example.com");
    expect(document.querySelector(".dbk-call-title")?.textContent).toBe("· Ana & Ben 🤝 Sam");
    await user.click(screen.getByRole("button", { name: "Add phone" }));
    await user.type(screen.getByLabelText("Phone"), "+1 555 0100");
    await user.type(screen.getByLabelText(/LinkedIn/), "/in/ana-example");
    await user.click(screen.getByRole("button", { name: "Name the meeting" }));
    await user.type(screen.getByLabelText("The meeting's name"), "Garden plans{Enter}");
    expect(document.querySelector(".dbk-call-title")?.textContent).toBe("· Garden plans 🤝 Sam");
    await user.click(screen.getByRole("button", { name: "Book 30m" }));
    await waitFor(() => expect(proxy.posts).toHaveLength(1));
    expect(proxy.posts[0]!.body).toMatchObject({
      guests: [{ email: "ben@example.com", name: "Ben Okafor" }],
      phone: "+1 555 0100",
      linkedin: "linkedin.com/in/ana-example",
      meetingName: "Garden plans",
    });
  });

  it("books a length its sibling link offers with that link", async () => {
    const sibling = { ...PAGE, link: { ...PAGE.link, slug: "60", lengths: [60], defaultLength: 60 } };
    const fetch = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = String(input);
      if (init.method === "POST") return json(200, { booked: { start: at(11), end: at(12), title: "Ana 🤝 Sam" } });
      if (!url.includes("?"))
        return json(200, { links: [{ slug: "meet", title: "Meet with Sam", lengths: [30] }, { slug: "60", title: "Meet with Sam", lengths: [60] }] });
      return json(200, url.includes("/60?") ? sibling : PAGE);
    });
    const single = { ...PAGE, link: { ...PAGE.link, lengths: [30] } };
    render(<DaybreakBooking api="/api/booking" slug="meet" initial={single} fetch={fetch as unknown as typeof globalThis.fetch} />);
    fireEvent.click(await screen.findByRole("button", { name: "60 minutes" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).startsWith("/api/booking/60?"))).toBe(true));
    const user = await fillForm();
    await user.click(await screen.findByRole("button", { name: "Book 60m" }));
    await waitFor(() => expect(fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    const post = fetch.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(String(post[0])).toBe("/api/booking/60");
  });

  it("reads the week again past the CDN's copy after a booking", async () => {
    proxy.answers.push(json(200, { booked: { start: at(11), end: at(11, 30), title: "Ana 🤝 Sam" } }));
    page();
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Book 30m" }));
    await screen.findByRole("heading", { name: "You're meeting Sam" });
    await user.click(screen.getByRole("button", { name: "Book another time" }));
    await waitFor(() => expect(proxy.gets).toContain("/api/booking/meet?from=2026-11-10&days=07"));
  });

  it("sends back the `registration` the site's proxy put on the page", async () => {
    proxy = fakeProxy(() => ({ ...PAGE, registration: "reg-from-the-site" }));
    proxy.answers.push(json(200, { booked: { start: at(11), end: at(11, 30), title: "Ana 🤝 Sam" } }));
    render(<DaybreakBooking api="/api/u/sam" slug="meet" fetch={proxy.fetch} />);
    await screen.findByRole("button", { name: "Book 30m" });
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Book 30m" }));
    await waitFor(() => expect(proxy.posts).toHaveLength(1));
    expect(proxy.posts[0]!.body.registration).toBe("reg-from-the-site");
  });

  it("sends no `registration` when the page has none, as bookingHandler's pages don't", async () => {
    proxy.answers.push(json(200, { booked: { start: at(11), end: at(11, 30), title: "Ana 🤝 Sam" } }));
    page();
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Book 30m" }));
    await waitFor(() => expect(proxy.posts).toHaveLength(1));
    expect("registration" in proxy.posts[0]!.body).toBe(false);
  });

  it("says a changed page changed, in the site's words, and reloads it past the CDN's copy", async () => {
    let registration = "old-registration";
    proxy = fakeProxy(() => ({ ...PAGE, registration }));
    const message = "This booking page changed. Reload it to see current times.";
    proxy.answers.push(json(409, { error: { code: "changed", message } }));
    render(<DaybreakBooking api="/api/u/sam" slug="meet" fetch={proxy.fetch} />);
    await screen.findByRole("button", { name: "Book 30m" });
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Book 30m" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(message);
    expect(screen.getByRole("button", { name: "Book 30m" }).hasAttribute("disabled")).toBe(true);
    registration = "new-registration";
    await user.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(proxy.gets.at(-1)).toBe("/api/u/sam/meet?days=07"));
    expect(await screen.findByRole("button", { name: "Book 30m" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();

    proxy.answers.push(json(200, { booked: { start: at(11), end: at(11, 30), title: "Ana 🤝 Sam" } }));
    const again = await fillForm();
    await again.click(screen.getByRole("button", { name: "Book 30m" }));
    await waitFor(() => expect(proxy.posts).toHaveLength(2));
    expect(proxy.posts[1]!.body.registration).toBe("new-registration");
  });

  it("reads the first week itself without one", async () => {
    render(<DaybreakBooking api="/api/u/sam/" slug="meet" fetch={proxy.fetch} />);
    expect(await screen.findByRole("heading", { name: "Meet with Sam" })).toBeTruthy();
    expect(proxy.gets[0]).toBe("/api/u/sam/meet?days=7");
  });

  it("says a closed link is closed, in the proxy's words", async () => {
    const fetch = (async () =>
      json(404, { error: { code: "not_found", message: "This booking page isn't taking bookings." } })) as typeof globalThis.fetch;
    render(<DaybreakBooking api="/api/u/sam" slug="meet" fetch={fetch} />);
    expect(await screen.findByText("This booking page isn't taking bookings.")).toBeTruthy();
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
    expect(screen.getByRole("button", { name: "All links" })).toBeTruthy();
  });
});

describe("the week strip from the keyboard", () => {
  afterEach(cleanup);

  const strip = (selection: number | null, onSelect = vi.fn(), length = 30) => {
    render(
      <WeekStrip
        days={PAGE.days}
        hostZone={PT}
        bookerZone="America/New_York"
        host="Sam"
        length={length}
        selection={selection}
        suggestions={PAGE.suggested}
        compact={false}
        onSelect={onSelect}
        onConfirm={vi.fn()}
      />,
    );
    return { group: screen.getByRole("group", { name: "Open times" }), onSelect };
  };

  it("starts on the best slot", () => {
    const { group, onSelect } = strip(null);
    fireEvent.keyDown(group, { key: "ArrowDown" });
    expect(onSelect).toHaveBeenCalledWith(at(11));
  });

  it("moves a half hour, an hour, and across busy time", () => {
    const { group, onSelect } = strip(at(9));
    fireEvent.keyDown(group, { key: "ArrowDown" });
    expect(onSelect).toHaveBeenLastCalledWith(at(9, 30));
    fireEvent.keyDown(group, { key: "ArrowDown", shiftKey: true });
    // Two starts on, across the busy hour; the spy leaves the prop at 9:00.
    expect(onSelect).toHaveBeenLastCalledWith(at(11));
    fireEvent.keyDown(group, { key: "End" });
    expect(onSelect).toHaveBeenLastCalledWith(at(11, 30));
  });

  it("moves to the same time on the next day, or the nearest open one", () => {
    const { group, onSelect } = strip(at(9));
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(onSelect).toHaveBeenLastCalledWith(at(10, 0, "2026-11-11"));
  });

  it("heads the booker's rail and the host's with their zones", () => {
    strip(at(11));
    expect(document.querySelector(".dbk-rail-start .dbk-zone-heading")?.textContent).toBe("ETYou");
    expect(document.querySelector(".dbk-rail-end .dbk-zone-heading")?.textContent).toBe("PTSam");
    expect(document.querySelector(".dbk-selection-time")?.textContent).toBe("2:00p");
    // A 30-minute block has no room for the host's clock; the card has it.
    expect(document.querySelector(".dbk-selection-host")).toBeNull();
  });

  it("puts the host's clock on a block tall enough for it", () => {
    strip(at(11), vi.fn(), 60);
    expect(document.querySelector(".dbk-selection-host")?.textContent).toBe("11:00a PT");
  });

  it("says when a Day has no open time", () => {
    render(
      <WeekStrip
        days={[...PAGE.days, { day: "2026-11-12", open: [] }]}
        hostZone={PT}
        bookerZone={PT}
        host="Sam"
        length={30}
        selection={null}
        suggestions={[]}
        compact
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("No open times")).toBeTruthy();
    expect(document.querySelector(".dbk-rail-start .dbk-zone-heading")?.textContent).toBe("PTYou & Sam");
  });
});

describe("the person check", () => {
  afterEach(() => {
    cleanup();
    delete window.turnstile;
  });

  it("draws Cloudflare's widget in the page's theme", async () => {
    const renderWidget = vi.fn(() => "widget-1");
    window.turnstile = { render: renderWidget, reset: vi.fn(), remove: vi.fn() };
    render(
      <DaybreakBooking api="/api/booking" slug="meet" initial={PAGE} theme="dark" turnstileSiteKey="example-site-key" fetch={fakeProxy().fetch} />,
    );
    await waitFor(() => expect(renderWidget).toHaveBeenCalled());
    expect(renderWidget.mock.calls[0]!.at(1)).toMatchObject({ theme: "dark", sitekey: "example-site-key" });
  });
});
