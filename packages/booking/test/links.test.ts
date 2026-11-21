import { describe, expect, it } from "vitest";

import { lengthChoices, linkGroups, siblingsOf } from "../src/page/links.js";
import type { ListedLink } from "../src/types.js";

const link = (slug: string, title: string, lengths: number[]): ListedLink => ({ slug, title, lengths });

// A host with one link per length, twice over under one title, and a lone link.
const links = [
  link("chat", "Chat with Sam", [30]),
  link("15", "Chat with Sam", [15]),
  link("60", "Chat with Sam", [60]),
  link("garden", "Chat with Sam", [30]),
  link("garden-15", "Chat with Sam", [15]),
  link("garden-60", "chat  with sam ", [60]),
  link("office-hours", "Office hours", [20, 40]),
];

describe("a link's siblings", () => {
  it("are the same-titled links in its family", () => {
    expect(siblingsOf(links, "garden").map((l) => l.slug)).toEqual(["garden", "garden-15", "garden-60"]);
    expect(siblingsOf(links, "garden-60").map((l) => l.slug)).toEqual(["garden", "garden-15", "garden-60"]);
  });

  it("put bare numbers with the one head that has no numbered siblings", () => {
    expect(siblingsOf(links, "chat").map((l) => l.slug)).toEqual(["chat", "15", "60"]);
    expect(siblingsOf(links, "15").map((l) => l.slug)).toEqual(["chat", "15", "60"]);
  });

  it("leave bare numbers alone when two heads could own them", () => {
    const two = [link("chat", "Talk", [30]), link("walk", "Talk", [45]), link("15", "Talk", [15])];
    expect(siblingsOf(two, "chat").map((l) => l.slug)).toEqual(["chat"]);
    expect(siblingsOf(two, "15").map((l) => l.slug)).toEqual(["15"]);
  });

  it("never cross titles", () => {
    expect(siblingsOf(links, "office-hours").map((l) => l.slug)).toEqual(["office-hours"]);
    expect(siblingsOf([link("talk", "Talk", [30]), link("talk-15", "Coffee", [15])], "talk")).toHaveLength(1);
  });

  it("are none for a link the list doesn't have", () => {
    expect(siblingsOf(links, "unlisted")).toEqual([]);
  });
});

describe("the lengths a page offers", () => {
  it("are the link's own, then each sibling's, shortest first", () => {
    expect(lengthChoices({ slug: "chat", lengths: [30] }, siblingsOf(links, "chat"))).toEqual([
      { length: 15, slug: "15" },
      { length: 30, slug: "chat" },
      { length: 60, slug: "60" },
    ]);
  });

  it("book a length the link has itself with the link", () => {
    expect(lengthChoices({ slug: "15", lengths: [15, 30] }, siblingsOf(links, "15"))).toEqual([
      { length: 15, slug: "15" },
      { length: 30, slug: "15" },
      { length: 60, slug: "60" },
    ]);
  });

  it("are the link's own without siblings", () => {
    expect(lengthChoices({ slug: "office-hours", lengths: [20, 40] }, [])).toEqual([
      { length: 20, slug: "office-hours" },
      { length: 40, slug: "office-hours" },
    ]);
  });
});

describe("the list's cards", () => {
  it("are one per title, opening its first head, with its siblings' lengths", () => {
    expect(linkGroups(links)).toEqual([
      { title: "Chat with Sam", slug: "chat", lengths: [15, 30, 60] },
      { title: "Office hours", slug: "office-hours", lengths: [20, 40] },
    ]);
  });

  it("open the first listed link when every one is a bare number, which are siblings", () => {
    expect(linkGroups([link("15", "Talk", [15]), link("60", "Talk", [60])])).toEqual([
      { title: "Talk", slug: "15", lengths: [15, 60] },
    ]);
  });
});
