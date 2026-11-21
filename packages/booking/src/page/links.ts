import type { ListedLink } from "../types.js";

/**
 * How the list groups a host's links. A host often makes one link per
 * length, all with the same title: `meet` for 30 minutes beside `15` and
 * `60`, or `coffee` beside `coffee-15` and `coffee-60`. The list shows one
 * card for each title, never the same title twice, opening the title's main
 * link. A link's own page offers only its own lengths, as /meet does, so a
 * sibling's length is booked from the sibling's own address.
 *
 * Siblings share a title, read without case or extra spaces, and a family:
 * a slug's family is the slug without a trailing `-<number>` (`coffee-15`
 * is `coffee`'s). A slug that's only a number (`15`) belongs to the one
 * same-titled link that has no numbered siblings of its own, as `meet` has
 * none beside `15` and `60`; with no such link, or more than one, the bare
 * numbers are a family of their own.
 */

const titleKey = (title: string) => title.replace(/\s+/g, " ").trim().toLowerCase();

const NUMBERED = /^(.+)-(\d+)$/;
const BARE = /^\d+$/;

/** A link that heads its family: neither `<family>-<number>` nor only a number. */
const isHead = (slug: string) => !NUMBERED.test(slug) && !BARE.test(slug);

function familyOf(slug: string, bareHome: string | null): string {
  const numbered = NUMBERED.exec(slug);
  if (numbered) return numbered[1]!;
  if (BARE.test(slug)) return bareHome ?? "";
  return slug;
}

/** Where a same-titled group's bare-number slugs belong: its one head without numbered siblings, or none. */
function bareHomeOf(group: ListedLink[]): string | null {
  const lonely = group.filter(
    (link) => isHead(link.slug) && !group.some((other) => NUMBERED.exec(other.slug)?.[1] === link.slug),
  );
  return lonely.length === 1 ? lonely[0]!.slug : null;
}

/** The listed links that are `slug`'s siblings, itself included, in listed order. Empty when `slug` isn't listed. */
export function siblingsOf(links: ListedLink[], slug: string): ListedLink[] {
  const self = links.find((link) => link.slug === slug);
  if (!self) return [];
  const group = links.filter((link) => titleKey(link.title) === titleKey(self.title));
  const home = bareHomeOf(group);
  const family = familyOf(slug, home);
  return group.filter((link) => familyOf(link.slug, home) === family);
}

/** A card in the list: one title, the link it opens, and every length its siblings offer. */
export type LinkGroup = { title: string; slug: string; lengths: number[] };

/**
 * The list's cards: one per title, in the order each title first appears.
 * A card opens its title's first listed head (`meet` before `15`), and
 * lists the lengths of that head's siblings.
 */
export function linkGroups(links: ListedLink[]): LinkGroup[] {
  const groups: LinkGroup[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    const key = titleKey(link.title);
    if (seen.has(key)) continue;
    seen.add(key);
    const group = links.filter((other) => titleKey(other.title) === key);
    const main = group.find((other) => isHead(other.slug)) ?? group[0]!;
    const lengths = [...new Set(siblingsOf(links, main.slug).flatMap((sibling) => sibling.lengths))].sort((a, b) => a - b);
    groups.push({ title: main.title, slug: main.slug, lengths });
  }
  return groups;
}
