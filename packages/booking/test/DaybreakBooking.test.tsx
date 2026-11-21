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

/** The proxy: GETs answer the page, POSTs answer what each test queues. */
function fakeProxy() {
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
    gets.push(url);
    return json(200, PAGE);
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, posts, gets, answers };
}

async function fillForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Name"), "Ana de Lima");
  await user.type(screen.getByLabelText("Email"), "ana@example.com");
  await user.type(screen.getByLabelText("What it's about"), "Planning");
  return user;
}

describe("booking a link", () => {
  let proxy: ReturnType<typeof fakeProxy>;
  beforeEach(() => {
    proxy = fakeProxy();
  });
  afterEach(cleanup);

  const page = () => render(<DaybreakBooking api="/api/booking" slug="meet" initial={PAGE} fetch={proxy.fetch} />);

  it("shows a slot in both zones and marks the best one", () => {
    page();
    const best = screen.getByRole("button", { name: "2:00 PM your time, 11:00 AM for Sam, a best time" });
    fireEvent.click(best);
    expect(best.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("11:00 AM PT for Sam")).toBeTruthy();
    expect(screen.getByText("Best for Sam")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Book 30 min" })).toBeTruthy();
  });

  it("titles the page from the link, and draws without asking when given the first week", () => {
    page();
    expect(screen.getByRole("heading", { name: "Meet with Sam" })).toBeTruthy();
    expect(proxy.gets).toEqual([]);
  });

  it("resizes the selection when the length changes", () => {
    page();
    fireEvent.click(screen.getByRole("button", { name: /^12:30 PM your time/ }));
    fireEvent.click(screen.getByRole("button", { name: "1 hr" }));
    // 9:30 PT can't hold an hour before 10, so the meeting slides to 9:00.
    expect(screen.getByRole("button", { name: "Book 1 hr" })).toBeTruthy();
    expect(screen.getAllByText("12:00 PM - 1:00 PM").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^12:00 PM your time/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("asks for another time when the slot was just taken", async () => {
    proxy.answers.push(json(409, { error: { code: "taken", message: "That time was just taken. Pick another." } }));
    page();
    fireEvent.click(screen.getByRole("button", { name: /^2:00 PM your time/ }));
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Book 30 min" }));
    expect((await screen.findByRole("alert")).textContent).toBe(MESSAGES.taken);
    expect(screen.getByRole("button", { name: "Pick a time first" })).toBeTruthy();
    // The week is read again, since its open time changed.
    await waitFor(() => expect(proxy.gets.length).toBeGreaterThan(0));
    expect(proxy.gets[0]).toBe("/api/booking/meet?days=7&from=2026-11-10");
  });

  it("says when the person check failed", async () => {
    proxy.answers.push(json(403, { error: { code: "forbidden", message: "No." } }));
    page();
    fireEvent.click(screen.getByRole("button", { name: /^2:00 PM your time/ }));
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Book 30 min" }));
    expect((await screen.findByRole("alert")).textContent).toBe(MESSAGES.challenge);
  });

  it("retries a dropped request with the same request ID, then confirms", async () => {
    proxy.answers.push(
      new TypeError("network"),
      json(200, { booked: { start: at(11), end: at(11, 30), title: "Ana 🤝 Sam" } }),
    );
    page();
    fireEvent.click(screen.getByRole("button", { name: /^2:00 PM your time/ }));
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Book 30 min" }));
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
    expect(document.body.textContent).toContain("2:00 PM - 2:30 PM your time, ET");
    expect(screen.getByText("11:00 AM - 11:30 AM PT for Sam")).toBeTruthy();
    expect(screen.getByText("ana@example.com")).toBeTruthy();
    expect(document.body.textContent).toContain("with the Google Meet link");
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

  const links = { links: [{ slug: "meet", title: "Meet with Sam", lengths: [15, 30] }] };

  it("links each one where linkHref says", async () => {
    const fetch = (async () => json(200, links)) as typeof globalThis.fetch;
    render(<DaybreakBooking api="/api/u/sam" fetch={fetch} linkHref={(slug) => `/u/sam/${slug}`} />);
    const link = await screen.findByRole("link", { name: /Meet with Sam/ });
    expect(link.getAttribute("href")).toBe("/u/sam/meet");
    expect(link.textContent).toContain("15 min · 30 min");
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

  const strip = (selection: number | null, onSelect = vi.fn()) => {
    render(
      <WeekStrip
        days={PAGE.days}
        hostZone={PT}
        bookerZone="America/New_York"
        host="Sam"
        length={30}
        selection={selection}
        suggestions={PAGE.suggested}
        onSelect={onSelect}
        onConfirm={vi.fn()}
      />,
    );
    return { group: screen.getByRole("group", { name: "Open times this week" }), onSelect };
  };

  it("starts on the best slot", () => {
    const { group, onSelect } = strip(null);
    fireEvent.keyDown(group, { key: "ArrowDown" });
    expect(onSelect).toHaveBeenCalledWith(at(11));
  });

  it("moves a quarter hour, an hour, and across busy time", () => {
    const { group, onSelect } = strip(at(9, 15));
    fireEvent.keyDown(group, { key: "ArrowDown" });
    expect(onSelect).toHaveBeenLastCalledWith(at(9, 30));
    fireEvent.keyDown(group, { key: "ArrowDown", shiftKey: true });
    // Four starts on, across the busy hour; the spy leaves the prop at 9:15.
    expect(onSelect).toHaveBeenLastCalledWith(at(11, 30));
    fireEvent.keyDown(group, { key: "ArrowUp" });
    expect(onSelect).toHaveBeenLastCalledWith(at(9));
    fireEvent.keyDown(group, { key: "End" });
    expect(onSelect).toHaveBeenLastCalledWith(at(11, 30));
  });

  it("moves to the same time on the next day, or the nearest open one", () => {
    const { group, onSelect } = strip(at(9, 15));
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(onSelect).toHaveBeenLastCalledWith(at(10, 0, "2026-11-11"));
  });

  it("shows the host's clock beside the booker's", () => {
    strip(at(11));
    expect(screen.getByText("ET")).toBeTruthy();
    expect(screen.getByText("PT")).toBeTruthy();
    // A 30-minute block has room for the booker's start alone.
    expect(screen.getByText("2:00 PM")).toBeTruthy();
    expect(screen.queryByText("11:00 AM PT")).toBeNull();
  });

  it("puts both clocks on a block long enough for two lines", () => {
    render(
      <WeekStrip
        days={PAGE.days}
        hostZone={PT}
        bookerZone="America/New_York"
        host="Sam"
        length={60}
        selection={at(11)}
        suggestions={[]}
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("2:00-3:00 PM")).toBeTruthy();
    expect(screen.getByText("11:00 AM PT")).toBeTruthy();
  });
});
