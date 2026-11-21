/**
 * The package's stylesheet: the booking page's, built from /meet's own
 * (Tailwind's classes, `meet.css`, and its CSS modules, compiled together by
 * scripts/build.mjs into `MEET_CSS`), then the list of links'.
 *
 * The page draws inside `.dbk-meet`, which carries Tailwind's reset and
 * /meet's tokens, so on a React site they reach no further than the page.
 * The list is scoped under `.dbk`, and takes the custom properties
 * `--dbk-accent` (First Light's `--fl-accent` when the page has it),
 * `--dbk-ink`, `--dbk-ground`, and `--dbk-font`.
 */

declare const __DAYBREAK_BOOKING_MEET_CSS__: string | undefined;

/** The booking page's own, compiled in at build time; empty when the source runs unbuilt, as in the tests. */
export const MEET_CSS: string =
  typeof __DAYBREAK_BOOKING_MEET_CSS__ === "string" ? __DAYBREAK_BOOKING_MEET_CSS__ : "";

const LIGHT = `
  --dbk-ink: #1d1d1f;
  --dbk-ground: #ffffff;
  --dbk-accent: var(--fl-accent, #007aff);
`;

const DARK = `
  --dbk-ink: #f5f5f7;
  --dbk-ground: #161617;
  --dbk-accent: var(--fl-accent, #0a84ff);
`;

/** `--dbk-ink` at `percent` of its strength. */
const ink = (percent: number) => `color-mix(in srgb, var(--dbk-ink) ${percent}%, transparent)`;
/** `--dbk-accent` at `percent` of its strength. */
const accent = (percent: number) => `color-mix(in srgb, var(--dbk-accent) ${percent}%, transparent)`;

const LIST_CSS = /* css */ `
.dbk {${LIGHT}
  --dbk-secondary: ${ink(55)};
  color: var(--dbk-ink);
  font-family: var(--dbk-font, -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif);
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
@media (prefers-color-scheme: dark) {
  .dbk:not([data-theme="light"]) {${DARK}}
}
.dbk[data-theme="dark"] {${DARK}}
.dbk-list { max-width: 44rem; margin: 0 auto; padding: 2.5rem 1rem; }
.dbk-list *, .dbk-list *::before, .dbk-list *::after { box-sizing: border-box; }
.dbk-list :where(p, h2, ul) { margin: 0; }
.dbk-list :where(ul) { padding: 0; list-style: none; }
.dbk-list :where(button) { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
.dbk-list svg { flex-shrink: 0; display: block; }
.dbk-unit { font-size: 0.8em; opacity: 0.8; }
.dbk-stack { display: flex; flex-direction: column; gap: 1.5rem; }
.dbk-empty {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;
  padding: 2.5rem 0; font-size: 0.875rem; color: var(--dbk-secondary);
}
.dbk-list :focus-visible { outline: 2px solid ${accent(60)}; outline-offset: 2px; }
.dbk-title {
  font-size: 1.75rem; font-weight: 800; letter-spacing: -0.022em; line-height: 1.15;
  overflow-wrap: anywhere;
}
.dbk-quiet {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;
  height: 1.875rem; padding: 0 0.875rem; border-radius: 8px; background: ${ink(6)};
  color: var(--dbk-ink); font-size: 0.8125rem; font-weight: 600;
}
.dbk-quiet:hover { background: ${ink(10)}; }
.dbk-link-cards { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr)); }
.dbk-link-card {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  width: 100%; height: 100%; padding: 1rem 1.125rem; text-align: left; text-decoration: none; color: inherit;
  border-radius: 14px; border: 1px solid ${ink(8)}; background: var(--dbk-ground);
  transition: border-color 150ms, box-shadow 150ms;
}
.dbk-link-card:hover { border-color: ${accent(45)}; box-shadow: 0 0 0 3px ${accent(12)}; }
.dbk-link-text { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
.dbk-link-title { font-size: 1rem; font-weight: 700; overflow-wrap: anywhere; }
.dbk-link-lengths { font-size: 0.875rem; font-weight: 600; color: var(--dbk-secondary); font-variant-numeric: tabular-nums; }
.dbk-link-caret { color: ${ink(35)}; }
`;

export const BOOKING_CSS = MEET_CSS + LIST_CSS;
