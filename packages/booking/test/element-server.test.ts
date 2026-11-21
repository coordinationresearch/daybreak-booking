// Plain Node, as a framework's server rendering imports the element: no
// HTMLElement, no customElements, no document.
import { describe, expect, it } from "vitest";

describe("importing the element on a server", () => {
  it("doesn't throw, and registers nothing", async () => {
    expect(typeof HTMLElement).toBe("undefined");
    const module = await import("../src/element/index.js");
    expect(typeof module.DaybreakBookingElement).toBe("function");
    expect(() => module.defineDaybreakBooking()).not.toThrow();
  });

  it("doesn't throw for the bundle either", async () => {
    // @ts-expect-error The bundle has no types of its own.
    await expect(import("../dist/element.js")).resolves.toBeTruthy();
  });
});
