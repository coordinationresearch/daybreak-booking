// @vitest-environment jsdom
// Loads the built bundle, dist/element.js, as a page would: React is inside
// it, so nothing else is imported. `npm test` builds first.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const PAGE = JSON.parse(readFileSync(join(process.cwd(), "fixtures/booking-api/cases.json"), "utf8")).cases.find(
  (c: { name: string }) => c.name === "page",
).response.body;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const fetchSpy = vi.fn(async (input: string | URL | Request) =>
  String(input).endsWith("/api/u/sam") ? json(200, { links: [{ slug: "meet", title: "Meet with Sam", lengths: [15, 30] }] }) : json(200, PAGE),
);

beforeAll(async () => {
  vi.stubGlobal("fetch", fetchSpy);
  // @ts-expect-error The bundle has no types of its own; dist/element/index.d.ts describes it.
  await import("../dist/element.js");
});

afterEach(() => {
  document.body.replaceChildren();
  fetchSpy.mockClear();
});

async function shadowText(element: HTMLElement, text: string) {
  await vi.waitFor(() => expect(element.shadowRoot?.textContent).toContain(text), { timeout: 3000 });
}

describe("<daybreak-booking>", () => {
  it("registers itself", () => {
    expect(customElements.get("daybreak-booking")).toBeTruthy();
  });

  it("reads the link's page from its proxy and draws it in a shadow root", async () => {
    const element = document.createElement("daybreak-booking");
    element.setAttribute("api", "/api/u/sam");
    element.setAttribute("slug", "meet");
    document.body.appendChild(element);
    await shadowText(element, "Meet with Sam");
    // The page, and the list beside it for the link's other lengths.
    expect(fetchSpy.mock.calls.map((call) => call[0])).toContain("/api/u/sam/meet?days=7");
    expect(fetchSpy.mock.calls.map((call) => call[0])).toContain("/api/u/sam");
    expect(element.shadowRoot!.textContent).toContain("Google Meet");
    expect(element.shadowRoot!.querySelector("form")).toBeTruthy();
    // The page's own styles stay out; the element brings its own.
    const styled = element.shadowRoot!.adoptedStyleSheets?.length || element.shadowRoot!.querySelectorAll("style").length;
    expect(styled).toBeGreaterThan(0);
  });

  it("lists the links without a slug, linked by link-href", async () => {
    const element = document.createElement("daybreak-booking");
    element.setAttribute("api", "/api/u/sam");
    element.setAttribute("link-href", "/u/sam/{slug}");
    document.body.appendChild(element);
    await shadowText(element, "Meet with Sam");
    expect(element.shadowRoot!.querySelector("a")!.getAttribute("href")).toBe("/u/sam/meet");
  });

  it("puts the Turnstile host in the light DOM, slotted in", async () => {
    const element = document.createElement("daybreak-booking");
    element.setAttribute("api", "/api/u/sam");
    element.setAttribute("slug", "meet");
    element.setAttribute("turnstile-site-key", "example-site-key");
    document.body.appendChild(element);
    await shadowText(element, "Meet with Sam");
    expect(element.querySelector('[slot="turnstile"]')).toBeTruthy();
    expect(element.shadowRoot!.querySelector('slot[name="turnstile"]')).toBeTruthy();
  });
});
