/**
 * The booking page's stylesheet. Colors come from First Light's tokens, the
 * `--fl-*` custom properties Daybreak's apps and site use
 * (`design/first-light.json` in Daybreak), with First Light's own values as
 * the defaults, so a page that sets `--fl-accent` restyles the picker. The
 * grays (`--dbk-text`, `--dbk-muted`, `--dbk-line`, `--dbk-card`) aren't
 * First Light tokens and can be set the same way. Everything is scoped
 * under `.dbk`, and the layout follows the page's own width through a
 * container query, so it fits a sidebar, an iframe, or a full page.
 */
export const BOOKING_CSS = /* css */ `
.dbk {
  --dbk-accent: var(--fl-accent, #0088ff);
  --dbk-on-accent: var(--fl-on-accent, #ffffff);
  --dbk-open: var(--fl-running, #28b44b);
  --dbk-best: var(--fl-sun, #ff9e47);
  --dbk-danger: var(--fl-today-red, #ff3b30);
  --dbk-ground: var(--fl-ground-schedule, #ffffff);
  --dbk-text: #1c1c1e;
  --dbk-muted: rgb(60 60 67 / 0.64);
  --dbk-line: rgb(60 60 67 / 0.16);
  --dbk-card: rgb(255 255 255 / 0.82);
  --dbk-dusk: #6b7fa8;
  --dbk-shadow: rgb(0 0 0 / 0.35);
  container: dbk / inline-size;
  color: var(--dbk-text);
  font-family: var(--dbk-font, inherit);
  font-size: 1rem;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
  .dbk:not([data-theme="light"]) {
    --dbk-accent: var(--fl-accent, #0091ff);
    --dbk-open: var(--fl-running, #2dbf50);
    --dbk-danger: var(--fl-today-red, #e03c33);
    --dbk-ground: var(--fl-ground-schedule, #141518);
    --dbk-text: #f2f2f7;
    --dbk-muted: rgb(235 235 245 / 0.6);
    --dbk-line: rgb(235 235 245 / 0.14);
    --dbk-card: rgb(28 28 32 / 0.82);
    --dbk-dusk: #8193bd;
    --dbk-shadow: rgb(0 0 0 / 0.7);
  }
}
.dbk[data-theme="dark"] {
  --dbk-accent: var(--fl-accent, #0091ff);
  --dbk-open: var(--fl-running, #2dbf50);
  --dbk-danger: var(--fl-today-red, #e03c33);
  --dbk-ground: var(--fl-ground-schedule, #141518);
  --dbk-text: #f2f2f7;
  --dbk-muted: rgb(235 235 245 / 0.6);
  --dbk-line: rgb(235 235 245 / 0.14);
  --dbk-card: rgb(28 28 32 / 0.82);
  --dbk-dusk: #8193bd;
  --dbk-shadow: rgb(0 0 0 / 0.7);
}
.dbk *, .dbk *::before, .dbk *::after { box-sizing: border-box; }
.dbk :where(p, h2, h3, ul, fieldset) { margin: 0; }
.dbk :where(ul) { padding: 0; list-style: none; }
.dbk :where(fieldset) { padding: 0; border: 0; min-width: 0; }
.dbk :where(button, input) { font: inherit; color: inherit; }
.dbk svg { flex-shrink: 0; }

.dbk-sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
.dbk-tabular { font-variant-numeric: tabular-nums; }
.dbk-muted { color: var(--dbk-muted); }
.dbk-strong { font-weight: 500; }
.dbk-strong-ink { color: var(--dbk-text); }
.dbk-small { font-size: 0.875rem; line-height: 1.25rem; }
.dbk-hint { font-size: 0.75rem; line-height: 1rem; color: var(--dbk-muted); }
.dbk-center { text-align: center; }
.dbk-truncate { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dbk-caps {
  font-size: 11px; font-weight: 500; text-transform: uppercase;
  letter-spacing: 0.14em; color: var(--dbk-muted);
}
.dbk-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.dbk-row-tight { display: flex; align-items: center; gap: 0.25rem; }
.dbk-stack-lg { display: flex; flex-direction: column; gap: 1.25rem; }
.dbk-stack-xl { display: flex; flex-direction: column; gap: 1.5rem; }
.dbk-gap-top-xs { margin-top: 0.25rem; }
.dbk-gap-top-lg { margin-top: 2rem; }

.dbk-header { display: flex; flex-direction: column; gap: 0.5rem; }
.dbk-title { font-size: 1.75rem; line-height: 1.2; font-weight: 600; letter-spacing: -0.01em; }
.dbk-intro { max-width: 40rem; color: var(--dbk-muted); }

.dbk-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
  height: 2.25rem; padding: 0 1rem; border-radius: 0.5rem;
  border: 1px solid transparent; background: transparent;
  font-size: 0.875rem; font-weight: 500; white-space: nowrap;
  cursor: pointer; user-select: none;
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease, opacity 120ms ease;
}
.dbk-btn:focus-visible { outline: 2px solid var(--dbk-accent); outline-offset: 2px; }
.dbk-btn:disabled { opacity: 0.5; cursor: default; pointer-events: none; }
.dbk-btn-sm { height: 2rem; padding: 0 0.75rem; font-size: 0.8125rem; }
.dbk-btn-icon { width: 2.25rem; padding: 0; }
.dbk-btn-block { width: 100%; }
.dbk-btn-solid { background: var(--dbk-accent); color: var(--dbk-on-accent); }
.dbk-btn-solid:hover { background: color-mix(in srgb, var(--dbk-accent) 88%, black); }
.dbk-btn-outline { border-color: var(--dbk-line); background: var(--dbk-ground); }
.dbk-btn-outline:hover { background: color-mix(in srgb, var(--dbk-accent) 8%, var(--dbk-ground)); }
.dbk-btn-ghost:hover { background: color-mix(in srgb, var(--dbk-text) 7%, transparent); }

.dbk-input {
  display: block; width: 100%; height: 2.25rem; padding: 0.25rem 0.75rem;
  border: 1px solid var(--dbk-line); border-radius: 0.5rem;
  background: var(--dbk-ground); font-size: 1rem;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
}
.dbk-input::placeholder { color: var(--dbk-muted); }
.dbk-input:focus-visible { outline: 2px solid var(--dbk-accent); outline-offset: 0; border-color: transparent; }
@container dbk (min-width: 48rem) { .dbk-input { font-size: 0.875rem; } }

.dbk-card {
  border: 1px solid var(--dbk-line); border-radius: 0.75rem;
  background: var(--dbk-card); box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
}
.dbk-alert { font-size: 0.875rem; font-weight: 500; color: var(--dbk-danger); }
.dbk-empty { padding: 2.5rem 0; font-size: 0.875rem; color: var(--dbk-muted); }

.dbk-layout { display: grid; gap: 2rem 2.5rem; }
@container dbk (min-width: 60rem) {
  .dbk-layout { grid-template-columns: minmax(0, 1fr) 21rem; }
  .dbk-aside { position: sticky; top: 1.5rem; align-self: start; }
}
.dbk-main { min-width: 0; display: flex; flex-direction: column; gap: 1.25rem; }
.dbk-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; }
.dbk-lengths { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.dbk-weeks { display: flex; align-items: center; gap: 0.25rem; }
.dbk-range { min-width: 7rem; text-align: center; font-size: 0.875rem; font-weight: 500; }
.dbk-days { transition: opacity 200ms ease; }
.dbk-faded { opacity: 0.5; }
.dbk-wide-only { display: none; }
@container dbk (min-width: 48rem) {
  .dbk-wide-only { display: block; }
  .dbk-narrow-only { display: none; }
}
.dbk-legend {
  margin-top: 1rem; display: flex; align-items: flex-start; gap: 0.375rem;
  font-size: 0.75rem; line-height: 1rem; color: var(--dbk-muted);
}
.dbk-legend-sun { margin-top: 1.5px; color: var(--dbk-best); }
.dbk-sun { color: var(--dbk-best); }

.dbk-form { display: flex; flex-direction: column; gap: 1rem; padding: 1.25rem; }
.dbk-eyebrow {
  font-size: 0.75rem; font-weight: 500; text-transform: uppercase;
  letter-spacing: 0.14em; color: var(--dbk-muted);
}
.dbk-best-tag {
  margin-left: 0.5rem; display: inline-flex; align-items: center; gap: 0.25rem;
  text-transform: none; letter-spacing: normal; color: var(--dbk-best);
}
.dbk-slot-day { margin-top: 0.25rem; font-size: 1.125rem; font-weight: 600; }
.dbk-slot-time { font-weight: 500; }
.dbk-call { display: flex; align-items: center; gap: 0.5rem; }
.dbk-fields { display: flex; flex-direction: column; gap: 0.75rem; }
.dbk-field { display: flex; flex-direction: column; gap: 0.25rem; }
.dbk-label { display: flex; align-items: baseline; justify-content: space-between; font-size: 0.875rem; font-weight: 500; }
.dbk-optional { font-size: 0.75rem; font-weight: 400; color: var(--dbk-muted); }
.dbk-turnstile:empty { display: none; }

/* The week strip: each Day a column of the host's hours, open time in
   green, the best slots glinting in the sun's amber, and each column washed
   from morning amber to evening dusk, so the hour reads as light before it
   reads as a number. */
.dbk-figure { user-select: none; -webkit-user-select: none; }
.dbk-strip { display: grid; column-gap: 0.375rem; }
.dbk-rail-head {
  display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 0.5rem;
  font-size: 11px; font-weight: 500; line-height: 1.25; color: var(--dbk-muted);
}
.dbk-rail-head-start { align-items: flex-end; padding-right: 0.5rem; text-align: right; }
.dbk-rail-head-end { align-items: flex-start; padding-left: 0.5rem; min-width: 0; }
.dbk-day-head { min-width: 0; padding-bottom: 0.5rem; }
.dbk-day-date { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.875rem; font-weight: 500; }
.dbk-day-note { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: var(--dbk-muted); }
.dbk-rail { position: relative; }
.dbk-rail-label {
  position: absolute; inset-inline: 0; transform: translateY(-50%);
  font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap;
}
.dbk-rail-label-start {
  padding-right: 0.5rem; text-align: right; font-weight: 500;
  color: color-mix(in srgb, var(--dbk-text) 80%, transparent);
}
.dbk-rail-label-end { padding-left: 0.5rem; color: var(--dbk-muted); }
.dbk-grid { display: grid; border-radius: 0.7rem; outline: none; }
.dbk-grid:focus-visible:not([data-pressed]) {
  box-shadow: 0 0 0 4px var(--dbk-ground), 0 0 0 6px var(--dbk-accent);
}
.dbk-day-body {
  position: relative;
  border-radius: 0.625rem;
  background-image:
    repeating-linear-gradient(to bottom, var(--dbk-line) 0 1px, transparent 1px var(--hour)),
    linear-gradient(to bottom,
      color-mix(in srgb, var(--dbk-best) 7%, transparent),
      transparent 38%, transparent 62%,
      color-mix(in srgb, var(--dbk-dusk) 9%, transparent));
  box-shadow: inset 0 0 0 1px var(--dbk-line);
  touch-action: pan-y;
  cursor: default;
}
.dbk-day-body[data-closed] {
  background-image: repeating-linear-gradient(135deg,
    color-mix(in srgb, var(--dbk-line) 60%, transparent) 0 1px, transparent 1px 7px);
}
.dbk-closed {
  position: absolute; inset-inline: 0; top: 0.75rem; text-align: center;
  font-size: 11px; color: var(--dbk-muted);
}
.dbk-open {
  position: absolute; inset-inline: 3px; border-radius: 0.4rem;
  background: color-mix(in srgb, var(--dbk-open) 20%, transparent);
  box-shadow: inset 2px 0 0 color-mix(in srgb, var(--dbk-open) 70%, transparent);
  cursor: pointer;
}
.dbk-open:hover { background: color-mix(in srgb, var(--dbk-open) 28%, transparent); }
.dbk-best {
  position: absolute; inset-inline: 5px; border-radius: 0.35rem; pointer-events: none;
  display: flex; align-items: flex-start; justify-content: flex-end; padding: 0.25rem;
  background: color-mix(in srgb, var(--dbk-best) 12%, transparent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--dbk-best) 55%, transparent),
    0 0 14px -2px color-mix(in srgb, var(--dbk-best) 45%, transparent);
  color: var(--dbk-best);
}
@media (prefers-reduced-motion: no-preference) {
  .dbk-best { animation: dbk-glint 3.2s ease-in-out infinite; }
}
@keyframes dbk-glint {
  0%, 100% {
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--dbk-best) 55%, transparent),
      0 0 10px -3px color-mix(in srgb, var(--dbk-best) 35%, transparent);
  }
  50% {
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--dbk-best) 70%, transparent),
      0 0 18px -2px color-mix(in srgb, var(--dbk-best) 55%, transparent);
  }
}
.dbk-ghost {
  position: absolute; inset-inline: 3px; border-radius: 0.4rem; pointer-events: none;
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--dbk-text) 35%, transparent);
  background: color-mix(in srgb, var(--dbk-text) 4%, transparent);
}
.dbk-selection {
  position: absolute; inset-inline: 2px; z-index: 2; overflow: hidden;
  display: flex; flex-direction: column; padding: 0 0.5rem;
  border-radius: 0.45rem;
  background: var(--dbk-accent); color: var(--dbk-on-accent);
  box-shadow: 0 6px 16px -6px var(--dbk-shadow), 0 1px 2px rgb(0 0 0 / 0.25);
  cursor: grab; touch-action: none;
}
.dbk-selection-tall { justify-content: flex-start; padding-top: 0.25rem; padding-bottom: 0.25rem; line-height: 1.25; }
.dbk-selection-short { justify-content: center; line-height: 1; }
.dbk-selection[data-dragging] {
  cursor: grabbing;
  box-shadow: 0 12px 26px -8px var(--dbk-shadow), 0 2px 4px rgb(0 0 0 / 0.25);
}
@media (prefers-reduced-motion: no-preference) {
  .dbk-selection {
    transition: top 110ms ease-out, height 200ms cubic-bezier(0.2, 0.9, 0.3, 1.2), box-shadow 150ms ease;
  }
}
.dbk-selection-start {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 0.75rem; font-weight: 600; font-variant-numeric: tabular-nums;
}
.dbk-selection-host {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 11px; font-variant-numeric: tabular-nums; opacity: 0.75;
}
.dbk-strip-hint { margin-top: 1.25rem; }

/* The narrow picker: one Day at a time, its starts as buttons. */
.dbk-day-chips { display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.25rem; }
.dbk-day-chip { height: auto; flex-shrink: 0; flex-direction: column; gap: 0; padding: 0.5rem 0.75rem; }
.dbk-chip-weekday { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; opacity: 0.75; }
.dbk-group-title { margin-bottom: 0.5rem; }
.dbk-times { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; }
.dbk-time-chip { height: auto; width: 100%; flex-direction: column; gap: 0; padding: 0.5rem 0.25rem; }
.dbk-time-chip[data-best] {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dbk-best) 60%, transparent);
  background: color-mix(in srgb, var(--dbk-best) 8%, var(--dbk-ground));
}
.dbk-time-main { font-size: 0.875rem; }
.dbk-time-host { font-size: 11px; opacity: 0.7; }

/* The confirmation takes the sky of the hour it's booked for. */
.dbk-postcard {
  margin: 0 auto; max-width: 36rem; padding: 2rem 1.5rem;
  border: 1px solid var(--dbk-line); border-radius: 1rem;
  background: var(--dbk-card); box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
}
@container dbk (min-width: 40rem) { .dbk-postcard { padding: 2rem 2.5rem; } }
.dbk-postcard[data-light="am"] {
  background: linear-gradient(to bottom, color-mix(in srgb, var(--dbk-best) 22%, transparent), transparent), var(--dbk-card);
}
.dbk-postcard[data-light="pm"] {
  background: linear-gradient(to bottom, color-mix(in srgb, var(--dbk-dusk) 24%, transparent), transparent), var(--dbk-card);
}
.dbk-done-icon { color: var(--dbk-open); }
.dbk-postcard-title { margin-top: 0.75rem; font-size: 1.5rem; line-height: 2rem; font-weight: 600; outline: none; }
.dbk-postcard-day { margin-top: 1rem; font-size: 1.125rem; font-weight: 500; }
.dbk-postcard-time { font-size: 1.125rem; }
.dbk-invite { margin-top: 1.5rem; display: flex; align-items: flex-start; gap: 0.5rem; }
.dbk-invite-icon { margin-top: 0.125rem; }

/* The list of links. */
.dbk-back { align-self: flex-start; }
.dbk-link-cards { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); }
.dbk-link-card {
  display: flex; flex-direction: column; gap: 0.25rem; width: 100%;
  padding: 1rem 1.25rem; text-align: left; color: inherit; text-decoration: none; cursor: pointer;
  transition: border-color 120ms ease;
}
.dbk-link-card:hover { border-color: var(--dbk-accent); }
.dbk-link-card:focus-visible { outline: 2px solid var(--dbk-accent); outline-offset: 2px; }
.dbk-link-title { font-weight: 600; }
`;
