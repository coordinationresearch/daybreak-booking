import { describe, expect, it } from "vitest";

import { daysFitting, lengthLabel, lengthWords, stepLabel, windowStart } from "../src/page/page.js";
import {
  MESSAGES,
  REQUEST_ID,
  attemptFor,
  attemptKey,
  linkedinAddress,
  makeRequestId,
  readBookingAnswer,
  recoveryFor,
  titleLead,
} from "../src/page/request.js";

describe("request IDs", () => {
  it("are 26 characters of Google's base32hex, as Daybreak takes", () => {
    for (let i = 0; i < 50; i++) {
      const id = makeRequestId();
      expect(id).toHaveLength(26);
      expect(id).toMatch(REQUEST_ID);
    }
  });

  it("map each byte to one of 32 characters, so none is favored", () => {
    const bytes = (b: Uint8Array) => b.map((_, i) => i * 10);
    expect(makeRequestId(bytes)).toBe("0aku8is6gq4eo2cm0aku8is6gq");
    expect(makeRequestId((b) => b.fill(255))).toBe("v".repeat(26));
  });

  it("stay the same on a retry of the same attempt and change otherwise", () => {
    let n = 0;
    const make = () => `id${++n}`;
    const fields = {
      start: 1,
      length: 30,
      name: "Ana",
      email: "ana@example.com",
      about: "Hi",
    };
    const first = attemptFor(null, attemptKey(fields), make);
    const retry = attemptFor(
      first,
      attemptKey({ ...fields, name: " Ana ", email: "ANA@example.com" }),
      make,
    );
    expect(retry.requestId).toBe(first.requestId);
    const moved = attemptFor(first, attemptKey({ ...fields, start: 2 }), make);
    expect(moved.requestId).not.toBe(first.requestId);
    const relabeled = attemptFor(
      first,
      attemptKey({ ...fields, linkedin: "linkedin.com/in/ana" }),
      make,
    );
    expect(relabeled.requestId).not.toBe(first.requestId);
    const withPhone = attemptFor(
      first,
      attemptKey({ ...fields, phone: "650 555 0123" }),
      make,
    );
    expect(withPhone.requestId).not.toBe(first.requestId);
  });
});

describe("Daybreak's answers", () => {
  it("reads a booking", () => {
    expect(
      readBookingAnswer(200, {
        booked: { start: 1, end: 2, title: "Ana <> Sam: Hi" },
      }),
    ).toEqual({
      ok: true,
      booked: { start: 1, end: 2, title: "Ana <> Sam: Hi" },
    });
  });

  it("shows a 400's own message, which says which field", () => {
    expect(
      readBookingAnswer(400, {
        error: {
          code: "invalid",
          message: "That email address doesn't look right",
        },
      }),
    ).toEqual({
      ok: false,
      code: "invalid",
      message: "That email address doesn't look right",
    });
    expect(readBookingAnswer(400, null)).toMatchObject({ code: "invalid" });
  });

  it("puts its own words on every other refusal", () => {
    const secret = { error: { code: "taken", message: "internal detail" } };
    expect(readBookingAnswer(409, secret)).toEqual({
      ok: false,
      code: "taken",
      message: MESSAGES.taken,
    });
    expect(readBookingAnswer(429, secret)).toMatchObject({
      code: "too_many",
      message: MESSAGES.tooMany,
    });
    expect(readBookingAnswer(503, secret)).toMatchObject({
      code: "closed",
      message: MESSAGES.closed,
    });
    expect(readBookingAnswer(404, secret)).toMatchObject({ code: "not_found" });
    expect(readBookingAnswer(500, secret)).toMatchObject({
      code: "unavailable",
    });
    // A 200 without a booking is no booking.
    expect(readBookingAnswer(200, { what: 1 })).toMatchObject({
      code: "unavailable",
    });
  });

  it("tells the page what to do next", () => {
    expect(recoveryFor("taken")).toBe("repick");
    expect(recoveryFor("invalid")).toBe("fix");
    expect(recoveryFor("challenge")).toBe("fix");
    expect(recoveryFor("unavailable")).toBe("retry");
    expect(recoveryFor("too_many")).toBe("stop");
    expect(recoveryFor("closed")).toBe("stop");
    expect(recoveryFor("not_found")).toBe("stop");
  });
});

describe("page helpers", () => {
  it("labels lengths as /meet does, minutes under 100 and hours past", () => {
    expect(lengthLabel(15)).toBe("15m");
    expect(lengthLabel(90)).toBe("90m");
    expect(lengthLabel(120)).toBe("2h");
    expect(lengthLabel(150)).toBe("2h 30m");
    expect(lengthWords(150)).toBe("2 hours 30 minutes");
    expect(lengthWords(1)).toBe("1 minute");
  });

  it("fits three to seven Days across the grid", () => {
    expect(daysFitting(320, true)).toBe(3);
    expect(daysFitting(560, false)).toBe(4);
    expect(daysFitting(900, false)).toBe(7);
  });

  it("names the Days shown by how far out they are", () => {
    expect(stepLabel(0, 7)).toBe("This week");
    expect(stepLabel(7, 7)).toBe("Next week");
    expect(stepLabel(21, 7)).toBe("In 3 weeks");
    expect(stepLabel(0, 3)).toBe("Next 3 days");
    expect(stepLabel(3, 3)).toBe("In 3 days");
    expect(stepLabel(15, 3)).toBe("In 2 weeks");
  });

  it("starts a window of Days only inside the bookable ones", () => {
    expect(windowStart("2026-11-10", "2026-11-30", 3)).toBe("2026-11-13");
    expect(windowStart("2026-11-10", "2026-11-30", 21)).toBeNull();
    expect(windowStart("2026-11-10", "2026-11-30", -3)).toBeNull();
  });
});

describe("a changed page", () => {
  it("reads the site's 409 `changed` in its words, and reloads, apart from a taken time", () => {
    const message = "This booking page changed. Reload it to see current times.";
    expect(readBookingAnswer(409, { error: { code: "changed", message } })).toEqual({ ok: false, code: "changed", message });
    expect(readBookingAnswer(409, { error: { code: "changed" } })).toMatchObject({ code: "changed", message: MESSAGES.changed });
    expect(readBookingAnswer(409, { error: { code: "taken", message: "x" } })).toMatchObject({ code: "taken" });
    expect(recoveryFor("changed")).toBe("reload");
  });
});

describe("the invite's title and the LinkedIn field", () => {
  it("leads with the booker, their guests, or the meeting's own name", () => {
    expect(titleLead("Sam Lee")).toBe("Sam");
    expect(titleLead("Sam Lee", [{ name: "Ana de Lima" }])).toBe("Sam & Ana");
    expect(titleLead("Sam Lee", [{}])).toBe("Sam +1");
    expect(titleLead("Sam Lee", [{ name: "Ana" }, { name: "Ben" }, {}])).toBe("Sam, Ana +2");
    expect(titleLead("Sam Lee", [{ name: "Ana" }], "  Garden   plans ")).toBe("Garden plans");
  });

  it("reads a profile path or a handle as a linkedin.com address", () => {
    expect(linkedinAddress("/in/sam-lee")).toBe("linkedin.com/in/sam-lee");
    expect(linkedinAddress("@samlee")).toBe("linkedin.com/in/samlee");
    expect(linkedinAddress("https://www.linkedin.com/in/sam")).toBe("https://www.linkedin.com/in/sam");
    expect(linkedinAddress("  ")).toBe("");
  });

  it("makes guests and the meeting's name part of the attempt", () => {
    const base = { start: 1, length: 30, name: "Sam", email: "sam@example.com" };
    expect(attemptKey(base)).toBe(attemptKey({ ...base, about: " ", guests: [] }));
    expect(attemptKey(base)).not.toBe(attemptKey({ ...base, guests: [{ email: "ana@example.com" }] }));
    expect(attemptKey(base)).not.toBe(attemptKey({ ...base, meetingName: "Garden plans" }));
    expect(attemptKey({ ...base, guests: [{ email: "Ana@Example.com" }] })).toBe(
      attemptKey({ ...base, guests: [{ email: "ana@example.com" }] }),
    );
  });
});
