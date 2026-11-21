// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { bookingHandler, createClient } from "../src/index.js";

describe("in a browser", () => {
  it("refuses to make a client, so a key never ships to a page", () => {
    expect(() => createClient({ url: "https://your-deployment.convex.site", key: "dbk_example-booking-key" })).toThrow(
      /only on a server/,
    );
  });

  it("refuses to make a handler", () => {
    expect(() => bookingHandler({ url: "https://your-deployment.convex.site", key: "dbk_example-booking-key" })).toThrow(
      /only on a server/,
    );
  });
});
