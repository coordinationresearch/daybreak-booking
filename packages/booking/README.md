# @coordination/booking

Booking pages for [Daybreak](https://daybreak.coordination.sh) users: a server client for a deployment's Booking API, a proxy handler for your own site, and the booking page as a React component and a custom element.

Daybreak's Booking API has no CORS and counts each caller toward a limit, so a browser never calls the deployment. Your server holds a booking key and proxies the page's calls; the page talks only to that proxy.

```
browser  ──>  your proxy (bookingHandler)  ──>  https://your-deployment.convex.site/book/v1
<daybreak-booking api="/api/booking">        holds the key, checks Turnstile, forwards the visitor's address
```

## Install

```sh
npm install @coordination/booking
```

Node 20.19 or later, Vercel, Cloudflare Workers, Deno 2 or later, or Bun. The server side (`@coordination/booking`) imports nothing. The page's own libraries (framer-motion, two Radix parts, Phosphor's icons, and Tailwind's class helpers) install with the package for `@coordination/booking/react`, and React 18 or 19 is its peer. The custom element carries all of it inside.

The package is ESM only. Node 20.19 and later can also `require()` it from CommonJS.

## You need

- Your deployment's HTTP address, `https://your-deployment.convex.site`.
- A booking key: in Daybreak, Settings › Booking › Website keys › New Key…. It's shown once.
- At least one listed Booking link, from Settings › Booking › Links.
- Optional: a [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) site key and secret, so bots can't book.

## The proxy: `bookingHandler`

A `(Request) => Promise<Response>` that serves:

| Route | Answers |
| --- | --- |
| `GET <basePath>` | `{ links: [{ slug, title, lengths }] }` |
| `GET <basePath>/<slug>?from=YYYY-MM-DD&days=28` | the link's page for up to 28 Days: `{ link, timeZone, firstDay, lastDay, days, suggested }` |
| `POST <basePath>/<slug>` | `{ booked: { start, end, title } }` |

A POST must be `Content-Type: application/json` and at most 16 KB; anything else is refused before the deployment is called, so another site's page can't post a form to your proxy without a CORS preflight.

Refusals answer `{ error: { code, message } }`: the deployment's own (`invalid` 400, `not_found` 404, `taken` 409, `too_many` 429, `closed` 503), or `invalid` 415 for a body that isn't JSON, `forbidden` 403 when the person check fails, and `unavailable` 502 when the deployment doesn't answer. Reads carry `Cache-Control: s-maxage=60` so a CDN shares them; bookings and refusals are never cached. No response carries the deployment's address.

Next.js, `app/api/booking/[[...path]]/route.ts`:

```ts
import { bookingHandler } from "@coordination/booking";

const handler = bookingHandler({
  url: process.env.DAYBREAK_URL!,
  key: process.env.DAYBREAK_BOOKING_KEY!,
  turnstileSecret: process.env.TURNSTILE_SECRET_KEY, // leave this line out to book without a person check
  basePath: "/api/booking", // the default
});

export { handler as GET, handler as POST };
```

On Vercel the handler reads the visitor's address from `x-real-ip`, which Vercel sets itself. Hosted anywhere else, pass `clientAddress` (below).

Cloudflare Workers:

```ts
import { bookingHandler } from "@coordination/booking";

export default {
  fetch(request: Request, env: Env) {
    return bookingHandler({ url: env.DAYBREAK_URL, key: env.DAYBREAK_BOOKING_KEY })(request);
  },
};
```

On Workers the handler reads the visitor's address from `cf-connecting-ip`, which Cloudflare sets itself.

#### The visitor's address

The handler sends the visitor's address beside the key, so the deployment's per-sender limit counts each visitor apart, and passes it to Turnstile as `remoteip`. It trusts a header only where the platform overwrites whatever the visitor sent: `cf-connecting-ip` on Cloudflare Workers, `x-real-ip` on Vercel (it checks `process.env.VERCEL`). Anywhere else it reads none, and never `x-forwarded-for`, since a visitor who sets one could look like a new sender on every request. Without an address, every visitor shares the key's limit.

Behind your own proxy, say which header it sets, and only one it overwrites:

```ts
bookingHandler({
  url: process.env.DAYBREAK_URL!,
  key: process.env.DAYBREAK_BOOKING_KEY!,
  // nginx: proxy_set_header X-Real-IP $remote_addr;
  clientAddress: (request) => request.headers.get("x-real-ip") ?? undefined,
});
```

#### Secrets

`key` is required: the handler and `createClient` throw at construction without one. Turnstile is opt-in by leaving `turnstileSecret` out; the handler then books without a person check, and the deployment's own limits still apply. Passing it empty, as `process.env.TURNSTILE_SECRET_KEY` is when the variable isn't set, throws, so a missing variable can't turn the check off without a word. With it, a POST needs `turnstileToken` in its body, which the page sends when it has `turnstileSiteKey`.

The handler and the client never follow a redirect: the key rides in a header, so a deployment that answers with one gets the `unavailable` error instead.

#### Fresh reads

The page reads four weeks at a time (`days=28`). A CDN keeps each read for `cacheSeconds` (60) by its address. Right after a booking, or a refused one, the page reads its Days again for a minute as `days=028` rather than `days=28`: the same Days, at an address the CDN hasn't kept. The handler takes it, and so does the Daybreak site's proxy, which refuses any query parameter but `from` and `days`. A proxy of your own with the same shape should take a `days` with a leading zero too.

## The page

### React: `@coordination/booking/react`

```tsx
import { DaybreakBooking } from "@coordination/booking/react";

export default function Book() {
  return <DaybreakBooking api="/api/booking" slug="meet" turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />;
}
```

| Prop | |
| --- | --- |
| `api` | The proxy's address. Required. |
| `slug` | The link. Without it, the page lists the links, one card per title. Links with the same title in one family (`meet` beside `15` and `60`, or `coffee` beside `coffee-15`) are one page's lengths: the page reads `GET <api>` to find them, offers each length, and books the one picked with its own link. |
| `initial` | The link's first four weeks, read on the server with `createClient(...).page(slug, { days: 28 })`, so the page draws without waiting. |
| `turnstileSiteKey` | Shows Cloudflare's widget and sends its token. |
| `heading` | The link's title, and its length and call ("30m · Google Meet"). On unless `false`. |
| `theme` | `"auto"` (the default, the visitor's setting), `"light"`, or `"dark"`. |
| `photo` | The host's photo, a URL. Without it, the page draws the host's initials on the accent's disc where the photo goes. |
| `home` | `{ href, label }`: the link on the back of the confirmation's ticket, beside the host's photo (as "example.com ↗"). Without it, the back shows the photo alone. |
| `linkHref` | `(slug) => href` for the list of links. Without it, a link opens in place. |
| `injectStyles` | The component adds its stylesheet to the document. Pass `false` and import `@coordination/booking/styles.css` yourself to avoid a flash on server-rendered pages. |

### Custom element: `@coordination/booking/element`

React, framer-motion, and the stylesheet are bundled inside, so it works on any page. The bundle is about 230 KB gzipped; on a React site, use `@coordination/booking/react` instead, about 85 KB gzipped beside the libraries your site may already have.

```html
<script type="module" src="https://unpkg.com/@coordination/booking@0.2.0/dist/element.js"></script>
<daybreak-booking api="/api/booking" slug="meet"></daybreak-booking>
```

Or `dist/element.global.js` with a plain `<script>`, or `import "@coordination/booking/element"` in a bundler. Attributes: `api`, `slug`, `turnstile-site-key`, `theme` (`light` or `dark`), `heading="off"`, `photo`, `home-href` and `home-label` (the link on the back of the confirmation's ticket), and `link-href` with `{slug}` in it, as `/book/{slug}`.

It draws in a shadow root, so your page's styles don't reach in. Cloudflare's widget draws in the light DOM and is slotted in. One booking page per document: it's drawn for the whole screen, with fixed layers. Importing the module during server rendering is safe: where `HTMLElement` doesn't exist, it registers nothing.

### On the Daybreak site's proxy

Daybreak's own `daybreak.coordination.sh/api/u/<name>` answers the same routes, and adds an opaque `registration` to each page it answers. The page sends it back beside `turnstileToken` when it books, and the site refuses a booking without the current one with 409 `changed` ("This booking page changed. Reload it to see current times."), so a page left open after the name moved to another host never books with them. The page shows that message and reads the page again past the CDN, so the next press of Book sends the current `registration`. `bookingHandler` adds no `registration` and drops one a page sends.

### Styling

The page is Daybreak's own booking page, the same markup, styles, and motion: the photo in its ring of dust, the title's entrance, the week grid with open time washed blue and a star on the times best for the host, the card (a sheet on a phone), and the confirmation's ticket. It's drawn for the whole screen and paints its own ground inside its box, `#f5f5f7` in light and `#0e0e0f` in dark; give your page's `<html>` and `<body>` the same, with no margin, so overscroll and the space past the page match. While it's shown, it sets your page's `<meta name="theme-color">` tags to the same, and gives them back when it goes. Its look isn't configurable.

## The client: `createClient`

For your own server code, such as rendering the first week or an agent's backend. It refuses to run in a browser page (where `window` and `document` both exist) or a web worker, so a key never ships to a browser. It needs a key.

```ts
import { BookingError, createClient } from "@coordination/booking";

const daybreak = createClient({ url: process.env.DAYBREAK_URL!, key: process.env.DAYBREAK_BOOKING_KEY! });

const { links } = await daybreak.links();
const page = await daybreak.page("meet", { from: "2026-10-12", days: 7 });
try {
  const booked = await daybreak.book(
    "meet",
    { start: page.suggested[0]!, length: 30, name: "Ana de Lima", email: "ana@example.com", about: "Planning" },
    { client: visitorAddress },
  );
} catch (error) {
  if (error instanceof BookingError && error.code === "taken") {
    // pick another time
  }
}
const live = await daybreak.checkKey(); // false once the key is revoked
```

Types (`BookingPage`, `BookingRequest`, `Booked`, and the rest) are generated from the API's OpenAPI document, which ships at `@coordination/booking/openapi.json`. A deployment serves its own at `GET /book/v1/openapi.json`.

## License

MIT. The icons are from [Phosphor](https://phosphoricons.com), MIT.
