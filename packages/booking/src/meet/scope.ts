/**
 * Where the page's elements live. On /meet that's the document; inside
 * `<daybreak-booking>` it's the element's shadow root, which
 * `document.querySelector` never reaches and whose events reach the
 * document retargeted to the element. So every query for the page's own
 * parts, its focused field, and every listener that reads an event's
 * target asks `scope()` instead of `document`. What belongs to the whole
 * page still asks the document: its size, its scroll, its visibility, and
 * its <head>.
 *
 * One page per document: the page is drawn for the whole screen, with
 * fixed layers and the browser's theme colour, so a second one would fight
 * the first anyway.
 */
let current: Document | ShadowRoot | null = null;

/**
 * What the page asks of its scope. A shadow root answers all of it, and
 * the pointer and focus events the page listens for are composed, so they
 * reach it; it borrows the document's types for their event names.
 */
export type Scope = Pick<
  Document,
  "querySelector" | "querySelectorAll" | "getElementById" | "activeElement" | "getAnimations" | "addEventListener" | "removeEventListener"
>;

/** The element sets its shadow root while it's connected; null goes back to the document. */
export function setScope(root: Document | ShadowRoot | null) {
  current = root;
}

export function scope(): Scope {
  return (current ?? document) as Scope;
}
