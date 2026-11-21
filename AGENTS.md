# daybreak-booking

A public MIT repo. Everything here ships to strangers, so:

- Never commit personal data, real deployment addresses, booking keys, Turnstile keys, Apple team IDs, or anyone's real name or email. Examples use `https://your-deployment.convex.site`, `example.com` addresses, and made-up people (Sam, Ana de Lima). A made-up secret in a test is assembled at run time (`["turnstile", "test", "secret"].join("-")`), so scanners never see a literal.
- The page hard-codes nothing about any one host: the host's name and the link's words come from the API.

## Layout

- `packages/booking/`: `@daybreak/booking`.
  - `src/client.ts`, `src/handler.ts`: the server side, which refuses to run where `window` exists.
  - `src/page/`: the page's pure rules (quarter-hour starts, two time zones, request IDs, what each refusal means). Tested in `test/slots`, `zones`, and `request`.
  - `src/react/`: the page. `DaybreakBooking` is the entry; `BookingPicker`, `WeekStrip`, and `TimeList` are the picker; `styles.ts` is its one stylesheet, scoped under `.dbk`.
  - `src/element/`: `<daybreak-booking>`, bundled with React by `scripts/build.mjs`.
  - `src/api.gen.ts`: generated from `fixtures/openapi.json` by `npm run generate`. Never edit it; the build fails while it's stale.
  - `fixtures/`: Daybreak's contract, copied in from Daybreak's repo by its `scripts/sync-booking-fixtures.ts`. Change the contract in Daybreak (`convex/bookingApi.ts`, `fixtures/booking-api/`), sync, then `npm run generate`.

## The API's rules

- The page calls only its proxy: `GET <api>`, `GET <api>/<slug>?from=&days=`, `POST <api>/<slug>` with `turnstileToken` beside the booking. `bookingHandler` and the Daybreak site's `/api/u/<name>` both answer that shape; keep them the same.
- v1 only grows. Read new fields as optional, and never send a field the OpenAPI document doesn't have.
- The handler forwards the visitor's address in `X-Daybreak-Booking-Client` beside the key in `X-Daybreak-Booking-Key`, and never lets the deployment's address reach a response, a header, or a log.

## Checks

`npm test` from the root builds the package and runs everything, including the element bundle in jsdom. `npm run typecheck`. Before a release, `npm pack --dry-run -w @daybreak/booking` and read the file list.

## Releases

Raise `version` in `packages/booking/package.json`, then `npm publish -w @daybreak/booking --access public` (its `prepack` builds). Only the maintainer publishes.
