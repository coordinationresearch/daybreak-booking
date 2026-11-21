# daybreak-booking

A public MIT repo. Everything here ships to strangers, so:

- Never commit personal data, real deployment addresses, booking keys, Turnstile keys, Apple team IDs, or anyone's real name or email. Examples use `https://your-deployment.convex.site`, `example.com` addresses, and made-up people (Sam, Ana de Lima). A made-up secret in a test is assembled at run time (`["turnstile", "test", "secret"].join("-")`), so scanners never see a literal.
- The page hard-codes nothing about any one host: the host's name and the link's words come from the API.

## Layout

- `packages/booking/`: `@coordination/booking`.
  - `src/client.ts`, `src/handler.ts`: the server side, which refuses to run in a browser page or a web worker, and throws at construction without a key.
  - `src/page/`: the page's pure rules (starts on the half hour, or the quarter for 15 minutes; two time zones; how many Days fit; which links are one link's other lengths; request IDs; what each refusal means). Tested in `test/slots`, `zones`, `links`, and `request`.
  - `src/react/`: the page, drawn like Daybreak's own booking page. `DaybreakBooking` is the entry and the list; `BookingPicker` (the head, the length choice, the Days' nav, and the card) and `WeekStrip` (the grid) are the picker; `styles.ts` is its one stylesheet, scoped under `.dbk`.
  - `src/element/`: `<daybreak-booking>`, bundled with React by `scripts/build.mjs`.
  - `src/api.gen.ts`: generated from `fixtures/openapi.json` by `npm run generate`. Never edit it; the build fails while it's stale.
  - `fixtures/`: Daybreak's contract, `openapi.json` and `booking-api/cases.json`. The maintainer syncs both from Daybreak, whose repo isn't public, with its `scripts/sync-booking-fixtures.ts`, then runs `npm run generate`. Don't edit them here, and don't ask a contributor to change Daybreak: when the contract looks wrong, open an issue for the maintainer. `test/contract.test.ts` fails when the two files disagree on a route or a status, as after syncing one without the other.

- `apps/booking-starter/`: the starter, a Next.js app on the workspace's `@coordination/booking`. `lib/daybreak.ts` makes the client and the proxy on first use, so `next build` runs without the variables; `app/health/route.ts` answers whether the key works and never shows the key or the deployment's address. Its README has the Deploy button, whose URL names this repo and `apps/booking-starter`; keep both in step with a move.

## The API's rules

- The page calls only its proxy: `GET <api>`, `GET <api>/<slug>?from=&days=` (in that order), `POST <api>/<slug>` as `application/json` with `turnstileToken` beside the booking. `bookingHandler` and the Daybreak site's `/api/u/<name>` both answer that shape; keep them the same.
- The site's proxy refuses any GET parameter but `from` and `days`. A read that must skip a CDN's copy asks for `days=07` instead of `days=7`, which both proxies take.
- The site's proxy puts an opaque `registration` on each page it answers and wants it back in the POST, or answers 409 `changed`. The page sends it back when the page body has one; `bookingHandler` drops it, as it does `turnstileToken`. Those two are the proxies' fields; never send the deployment a field its OpenAPI document doesn't have.
- v1 only grows. Read new fields as optional.
- The handler forwards the visitor's address in `X-Daybreak-Booking-Client` beside the key in `X-Daybreak-Booking-Key`, and never lets the deployment's address reach a response, a header, or a log. It trusts an address header only where the platform overwrites it (Cloudflare Workers, Vercel), never `x-forwarded-for`, unless the site passes `clientAddress`.
- Every upstream fetch, the deployment's and Turnstile's, sets `redirect: "error"`, so the key never follows a redirect.

## Checks

`npm test` from the root builds the package and runs everything, including the element bundle in jsdom. `npm run typecheck`. After changing the starter, `npm run build -w booking-starter`. Before a release, `npm pack --dry-run -w @coordination/booking` and read the file list.

## Releases

Raise `version` in `packages/booking/package.json`, then `npm publish -w @coordination/booking --access public` (its `prepack` builds). Only the maintainer publishes.
