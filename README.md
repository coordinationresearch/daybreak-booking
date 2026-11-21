# daybreak-booking

Booking pages for [Daybreak](https://daybreak.coordination.sh), the daily planner and time tracker: put your Daybreak Booking links on your own website.

- [`packages/booking`](packages/booking): `@daybreak/booking` on npm. A proxy handler for your server, a server client, and the booking page as a React component and a `<daybreak-booking>` custom element. Its README is the guide.
- `apps/booking-starter` (coming): a site you deploy to Vercel in one click and change as you like.

Daybreak's own `daybreak.coordination.sh/u/<name>` pages draw the same element.

## Develop

```sh
npm install
npm test        # builds the package, then runs its tests
npm run typecheck
```

Node 20.19 or later.

`packages/booking/fixtures/` holds Daybreak's Booking API contract: `booking-api/cases.json`, request and response pairs that Daybreak's own tests run against the deployment and this package's tests run against a fake one, and `openapi.json`, the API's OpenAPI document. The maintainer syncs both from Daybreak, so don't edit them here. If the API seems to answer something the contract doesn't say, open an issue.

MIT licensed.
