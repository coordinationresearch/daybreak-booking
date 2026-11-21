/**
 * The booking page's stylesheet, in the look of Daybreak's own booking page
 * (/meet): the system font at medium weight or heavier, one blue accent,
 * hairlines at a few percent of the ink, the schedule's grid on a ground a
 * step lighter than the page, and a card for the form.
 *
 * Colors are custom properties a site can set: `--dbk-accent` (First Light's
 * `--fl-accent` when the page has it), `--dbk-ink`, `--dbk-ground` (the
 * grid and fields), `--dbk-raised` (a chosen segment), and `--dbk-red` (the
 * now line). `--dbk-font` replaces the system font. The page itself paints
 * no background, so it sits on the site's. Everything is scoped under
 * `.dbk`. The page measures its own width, so it fits a sidebar, an iframe,
 * or a full page.
 */
const LIGHT = `
  --dbk-ink: #1d1d1f;
  --dbk-ground: #ffffff;
  --dbk-raised: #ffffff;
  --dbk-accent: var(--fl-accent, #007aff);
  --dbk-red: #ff3b30;
  --dbk-shade: 0.02;
  --dbk-raised-shadow: 0 1px 2px rgb(0 0 0 / 0.12), 0 0 0 0.5px rgb(0 0 0 / 0.06);
`;

const DARK = `
  --dbk-ink: #f5f5f7;
  --dbk-ground: #161617;
  --dbk-raised: #323233;
  --dbk-accent: var(--fl-accent, #0a84ff);
  --dbk-red: #e03c33;
  --dbk-shade: 0.05;
  --dbk-raised-shadow: 0 1px 2px rgb(0 0 0 / 0.4), 0 0 0 0.5px rgb(255 255 255 / 0.06);
`;

/** `--dbk-ink` at `percent` of its strength. */
const ink = (percent: number) => `color-mix(in srgb, var(--dbk-ink) ${percent}%, transparent)`;
/** `--dbk-accent` at `percent` of its strength. */
const accent = (percent: number) => `color-mix(in srgb, var(--dbk-accent) ${percent}%, transparent)`;

/** The blue's finish, lit from above, which the Book button, the meeting, and the Best badge share. */
const LIT = `
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--dbk-accent), #fff 16%) 0%,
    var(--dbk-accent) 55%,
    color-mix(in srgb, var(--dbk-accent), #000 9%) 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.3), inset 0 -1px 0 rgb(0 0 0 / 0.16), 0 1px 3px rgb(0 0 0 / 0.16);
  color: #fff;
  text-shadow: 0 -1px 0 rgb(0 0 0 / 0.12);
`;

export const BOOKING_CSS = /* css */ `
.dbk {${LIGHT}
  --dbk-hairline: ${ink(6)};
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
.dbk *, .dbk *::before, .dbk *::after { box-sizing: border-box; }
.dbk :where(p, h2, h3, ul, fieldset) { margin: 0; }
.dbk :where(ul) { padding: 0; list-style: none; }
.dbk :where(fieldset) { padding: 0; border: 0; min-width: 0; }
.dbk :where(button, input, textarea) { font: inherit; color: inherit; }
.dbk :where(button) { background: none; border: 0; padding: 0; cursor: pointer; }
.dbk :where(button:disabled) { cursor: default; }
.dbk svg { flex-shrink: 0; display: block; }

.dbk-sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
.dbk-muted { color: var(--dbk-secondary); }
.dbk-strong { font-weight: 600; color: var(--dbk-ink); }
.dbk-small { font-size: 0.8125rem; }
.dbk-hint { font-size: 0.75rem; color: var(--dbk-secondary); }
.dbk-unit { font-size: 0.8em; opacity: 0.8; }
.dbk-zone { font-size: 0.75em; color: var(--dbk-secondary); }
.dbk-aside { font-size: 0.85em; color: var(--dbk-secondary); font-weight: 500; }
.dbk-dash { padding-inline: 0.12em; opacity: 0.4; }
.dbk-stack { display: flex; flex-direction: column; gap: 1.5rem; }
.dbk-faded { opacity: 0.55; transition: opacity 150ms; }
.dbk-empty {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;
  padding: 2.5rem 0; font-size: 0.875rem; color: var(--dbk-secondary);
}
.dbk-alert {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
  border-radius: 10px; padding: 0.5rem 0.75rem;
  background: color-mix(in srgb, var(--dbk-red) 10%, transparent);
  color: var(--dbk-red); font-size: 0.8125rem; font-weight: 600;
}
.dbk :focus-visible { outline: 2px solid ${accent(60)}; outline-offset: 2px; }

/* ---------- The head ---------- */

.dbk-page { display: flex; flex-direction: column; gap: 1.75rem; }
.dbk-header { min-width: 0; }
.dbk-title {
  font-size: 1.75rem; font-weight: 800; letter-spacing: -0.022em; line-height: 1.15;
  overflow-wrap: anywhere;
}
.dbk-facts {
  margin-top: 0.125rem; font-size: 1.0625rem; font-weight: 600;
  font-variant-numeric: tabular-nums; color: var(--dbk-secondary);
}
.dbk-narrow .dbk-header { text-align: center; }
.dbk-narrow .dbk-title { font-size: 1.5rem; }
.dbk-back {
  align-self: flex-start; border-radius: 6px; padding: 2px 6px; margin-left: -6px;
  font-size: 0.8125rem; font-weight: 600; color: var(--dbk-secondary);
}
.dbk-back:hover { color: var(--dbk-ink); }

/* ---------- Layout ---------- */

.dbk-layout { display: grid; gap: 2rem 2.5rem; grid-template-columns: minmax(0, 1fr) 21rem; align-items: start; }
.dbk-narrow .dbk-layout { grid-template-columns: minmax(0, 1fr); }
.dbk-main { min-width: 0; display: flex; flex-direction: column; gap: 1rem; }
.dbk-aside { position: sticky; top: 1.5rem; min-width: 0; }
.dbk-narrow .dbk-aside { position: static; }

.dbk-toolbar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 0.75rem; }
.dbk-narrow .dbk-toolbar { grid-template-columns: minmax(0, 1fr); justify-items: center; }
.dbk-narrow .dbk-toolbar > div:empty { display: none; }

.dbk-segmented {
  display: inline-flex; gap: 2px; padding: 2px; border-radius: 8px; background: ${ink(6)};
}
.dbk-segment {
  border-radius: 6px; padding: 4px 12px; font-size: 0.8125rem; font-weight: 600;
  font-variant-numeric: tabular-nums; color: ${ink(80)}; white-space: nowrap;
  transition: background-color 150ms ease, box-shadow 150ms ease;
}
.dbk-segment:hover { color: var(--dbk-ink); }
.dbk-segment[aria-pressed="true"] { background: var(--dbk-raised); box-shadow: var(--dbk-raised-shadow); color: var(--dbk-ink); }

.dbk-nav { display: flex; align-items: center; gap: 0.5rem; }
.dbk-chevron {
  display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 6px;
  color: ${ink(70)};
}
.dbk-chevron:hover:not(:disabled) { background: ${ink(6)}; color: var(--dbk-ink); }
.dbk-chevron:disabled { opacity: 0.3; }
.dbk-nav-label {
  position: relative; border-radius: 6px; padding: 0 2px;
  font-size: 1.0625rem; font-weight: 700; white-space: nowrap;
}
.dbk-nav-dot {
  position: absolute; top: 0; right: -6px; width: 6px; height: 6px; border-radius: 999px;
  background: var(--dbk-accent); transition: scale 150ms ease-out;
}
.dbk-nav-label:hover:not(:disabled) .dbk-nav-dot { scale: 1.4; }

/* ---------- The grid ---------- */

.dbk-strip { --inset: 4px; --block-radius: 8px; --panel-radius: 12px; user-select: none; -webkit-user-select: none; }
.dbk-strip-grid { display: grid; column-gap: 0; }
.dbk-day-head { display: flex; flex-direction: column; padding: 0 0 0.5rem 0.75rem; min-width: 0; line-height: 1.25; }
.dbk-day-weekday { font-size: 0.875rem; font-weight: 700; }
.dbk-day-date { font-size: 0.875rem; font-weight: 600; color: var(--dbk-secondary); white-space: nowrap; font-variant-numeric: tabular-nums; }
.dbk-strip-compact .dbk-day-head { padding-left: 0.5rem; }

.dbk-rail { position: relative; }
.dbk-rail-start { margin-right: 10px; }
.dbk-rail-end { margin-left: 10px; }
.dbk-rail-label {
  position: absolute; inset-inline: 0; transform: translateY(-50%);
  font-size: 10.5px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap;
  color: var(--dbk-secondary); transition: opacity 200ms ease-out;
}
.dbk-rail-label[data-covered] { opacity: 0; }
.dbk-rail-start .dbk-rail-label, .dbk-rail-start .dbk-zone-heading { text-align: right; }
.dbk-zone-heading {
  position: absolute; inset-inline: 0; top: calc(var(--inset) - 1px);
  display: flex; flex-direction: column; font-size: 10.5px; font-weight: 600; line-height: 1.25;
}
.dbk-zone-who { font-size: 9px; font-weight: 500; color: ${ink(36)}; }
.dbk-now-pill {
  position: absolute; right: -11px; z-index: 1; height: 14px; padding: 0 3px; border-radius: 4px;
  background: var(--dbk-red); color: #fff; font-size: 10px; font-weight: 600; line-height: 14px;
  font-variant-numeric: tabular-nums; white-space: nowrap; translate: 0 -50%;
}

.dbk-days {
  position: relative; display: grid; border: 1px solid var(--dbk-hairline);
  border-radius: var(--panel-radius); background: var(--dbk-ground); outline: none; touch-action: pan-y;
}
.dbk-days:focus-visible:not([data-pressed]) .dbk-selection {
  box-shadow: 0 0 0 2px var(--dbk-ground), 0 0 0 4px ${accent(60)};
}
.dbk-days:focus-visible:not([data-pressed]):not(:has([data-selection])) { box-shadow: inset 0 0 0 1px ${accent(45)}; }
.dbk-hour-line { position: absolute; inset-inline: 0; height: 1px; background: var(--dbk-hairline); pointer-events: none; }
.dbk-day { position: relative; min-width: 0; }
.dbk-day + .dbk-day { border-left: 1px solid var(--dbk-hairline); }
.dbk-day:first-of-type { border-start-start-radius: 11px; border-end-start-radius: 11px; }
.dbk-day:last-child { border-start-end-radius: 11px; border-end-end-radius: 11px; }
.dbk-day[data-weekend]:not([data-closed]) { background: rgb(0 0 0 / var(--dbk-shade)); }
.dbk-closed-note {
  position: absolute; top: 10px; inset-inline: 4px; text-align: center;
  font-size: 0.75rem; font-weight: 500; color: ${ink(22)}; white-space: nowrap; overflow: hidden;
}
.dbk-open {
  position: absolute; inset-inline: var(--inset); border-radius: var(--block-radius);
  background: ${accent(10)}; cursor: pointer;
}
.dbk-best-dot {
  position: absolute; right: calc(var(--inset) + 2px); z-index: 1; color: var(--dbk-accent);
  filter: drop-shadow(0 1px 0.6px rgb(0 0 0 / 0.22)) drop-shadow(0 0 2px ${accent(30)});
  pointer-events: auto; cursor: pointer;
}
.dbk-ghost {
  position: absolute; inset-inline: var(--inset); border-radius: var(--block-radius); pointer-events: none;
  background: ${accent(6)}; box-shadow: inset 0 0 0 1px ${accent(50)};
}
.dbk-now-line {
  position: absolute; left: 0; right: 3px; z-index: 3; height: 2px; margin-top: -1px; border-radius: 1px;
  background: var(--dbk-red); pointer-events: none;
}
.dbk-selection {
  ${LIT}
  position: absolute; inset-inline: var(--inset); z-index: 2; overflow: hidden;
  display: flex; flex-direction: column; justify-content: flex-start;
  padding: 3px 8px; border-radius: var(--block-radius);
  font-size: 0.75rem; font-weight: 600; line-height: 1.2; cursor: grab; touch-action: none;
  transition: top 120ms ease-out;
}
.dbk-selection[data-dragging] { cursor: grabbing; transition: none; box-shadow: 0 0 6px rgb(0 0 0 / 0.12), 0 0 26px rgb(0 0 0 / 0.22); }
.dbk-selection[data-best] { padding-right: 18px; }
.dbk-selection > span { white-space: nowrap; overflow: hidden; text-overflow: clip; }
.dbk-selection-date { font-weight: 500; }
.dbk-selection-host { opacity: 0.8; font-weight: 500; }
.dbk-selection-star { position: absolute; top: 4px; right: 4px; }

/* ---------- The card ---------- */

.dbk-card {
  display: flex; flex-direction: column; gap: 1.25rem; padding: 1.5rem;
  border-radius: 18px; border: 1px solid ${ink(8)}; background: ${ink(2.5)};
}
.dbk-when { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }
.dbk-when-text { min-width: 0; }
.dbk-when-day { font-size: 1.0625rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.dbk-when-time { font-size: 1.0625rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.dbk-when-host { font-size: 0.8125rem; color: var(--dbk-secondary); font-variant-numeric: tabular-nums; }
.dbk-capsule {
  ${LIT}
  display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0;
  border-radius: 999px; padding: 1px 8px; font-size: 0.75rem; font-weight: 600;
}
.dbk-capsule-back {
  display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0;
  border-radius: 999px; padding: 1px 8px; background: ${ink(6)};
  color: var(--dbk-secondary); font-size: 0.75rem; font-weight: 600;
}
.dbk-capsule-back:hover { background: ${ink(10)}; color: ${ink(70)}; }

.dbk-fields { display: flex; flex-direction: column; gap: 1rem; }
.dbk-field { display: flex; flex-direction: column; gap: 0.375rem; }
.dbk-label { display: flex; align-items: baseline; justify-content: space-between; font-size: 0.8125rem; font-weight: 700; }
.dbk-optional { font-size: 0.6rem; font-weight: 500; color: ${ink(44)}; }
.dbk-input {
  width: 100%; height: 2.25rem; border-radius: 10px; padding: 0 0.75rem;
  border: 1px solid ${ink(12)}; background: var(--dbk-ground);
  font-size: 0.875rem; font-weight: 500; outline: none;
}
.dbk-input::placeholder { color: ${ink(35)}; }
.dbk-input:focus-visible { outline: none; border-color: var(--dbk-accent); box-shadow: 0 0 0 3px ${accent(25)}; }
.dbk-growing {
  display: block; min-height: 2.25rem; max-height: calc(5 * 1.25rem + 16px); padding-block: 7px;
  line-height: 1.25rem; resize: none; overflow-y: auto; field-sizing: content;
}
.dbk-guest { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr) 1.75rem; align-items: center; gap: 0.375rem; }
.dbk-phone { display: grid; grid-template-columns: minmax(0, 1fr) 1.75rem; align-items: center; gap: 0.375rem; }
.dbk-remove {
  display: inline-grid; place-items: center; width: 1.75rem; height: 1.75rem; border-radius: 999px;
  color: ${ink(45)}; transition: color 150ms ease, background-color 150ms ease;
}
.dbk-remove:hover { color: var(--dbk-ink); background: ${ink(6)}; }
.dbk-adds { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; margin-top: -0.25rem; }
.dbk-add {
  display: inline-flex; align-items: center; gap: 0.3rem; border-radius: 6px;
  color: var(--dbk-secondary); font-size: 0.8125rem; font-weight: 500;
}
.dbk-add:hover { color: var(--dbk-ink); }

.dbk-call {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.5rem;
  font-size: 0.8125rem; color: var(--dbk-secondary);
}
.dbk-call-title { color: var(--dbk-secondary); }
.dbk-naming { display: inline-flex; align-items: center; gap: 0.375rem; min-width: 0; }
.dbk-meeting-name {
  min-width: 0; width: 11rem; height: 1.75rem; border-radius: 8px; padding: 0 0.5rem;
  border: 1px solid ${ink(12)}; background: var(--dbk-ground); font-size: 0.8125rem; outline: none;
}
.dbk-meeting-name:focus-visible { border-color: var(--dbk-accent); box-shadow: 0 0 0 3px ${accent(25)}; }

.dbk-primary {
  ${LIT}
  position: relative; width: 100%; height: 2.7rem; border-radius: 10px;
  font-size: 0.9375rem; font-weight: 700; font-variant-numeric: tabular-nums;
  user-select: none; -webkit-user-select: none; transition: box-shadow 260ms ease-out, filter 150ms;
}
.dbk-primary:disabled { filter: saturate(0.6) brightness(0.8); color: rgb(255 255 255 / 0.6); }
@media (hover: hover) {
  .dbk-primary:hover:not(:disabled) { filter: brightness(1.06); }
}
.dbk-checking { margin-top: -0.25rem; text-align: center; font-size: 0.8125rem; color: var(--dbk-secondary); }
.dbk-quiet {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;
  height: 2.25rem; padding: 0 0.875rem; border-radius: 8px; background: ${ink(6)};
  color: var(--dbk-ink); font-size: 0.875rem; font-weight: 600;
}
.dbk-quiet:hover { background: ${ink(10)}; }
.dbk-quiet-sm { height: 1.875rem; font-size: 0.8125rem; }

/* A phone's bar at the foot: the time picked, until the card scrolls into view. */
.dbk-peek {
  position: sticky; bottom: max(12px, env(safe-area-inset-bottom)); z-index: 4;
  display: flex; flex-direction: column; gap: 0.25rem; width: 100%; text-align: left;
  padding: 0.875rem 1.25rem; border-radius: 22px; border: 1px solid ${ink(10)};
  background: color-mix(in srgb, var(--dbk-ground) 86%, transparent);
  -webkit-backdrop-filter: blur(20px) saturate(1.6); backdrop-filter: blur(20px) saturate(1.6);
  box-shadow: 0 8px 30px rgb(0 0 0 / 0.22);
}
.dbk-peek-hint { font-size: 0.8125rem; font-weight: 600; color: var(--dbk-accent); }

/* ---------- Booked ---------- */

.dbk-done { align-items: flex-start; gap: 0.5rem; max-width: 30rem; }
.dbk-done-icon { color: var(--dbk-accent); margin-bottom: 0.25rem; }
.dbk-done-title { font-size: 1.375rem; font-weight: 800; letter-spacing: -0.015em; outline: none; }
.dbk-invite { display: flex; gap: 0.5rem; margin-top: 0.75rem; font-size: 0.875rem; color: var(--dbk-secondary); }
.dbk-invite svg { color: var(--dbk-accent); margin-top: 1px; }
.dbk-done .dbk-quiet { margin-top: 1rem; }

/* ---------- The list ---------- */

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

@media (prefers-reduced-motion: reduce) {
  .dbk-selection, .dbk-primary, .dbk-segment { transition: none; }
}
`;
