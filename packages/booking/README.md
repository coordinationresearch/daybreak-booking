# @daybreak/booking

Booking pages for [Daybreak](https://daybreak.coordination.sh) users: a server client for a deployment's Booking API, a proxy handler for your own site, and the booking page as a React component and a custom element.

Daybreak's Booking API has no CORS and counts each caller toward a limit, so a browser never calls the deployment. Your server holds a booking key and proxies the page's calls; the page talks only to that proxy.

```
browser  ──>  your proxy (bookingHandler)  ──>  https://your-deployment.convex.site/book/v1
<daybreak-booking api="/api/booking">        holds the key, checks Turnstile, forwards the visitor's address
```

## Install

```sh
npm install @daybreak/booking
```

Node 20 or later, Vercel, Cloudflare Workers, Deno, or Bun. No runtime dependencies; React 18 or 19 is a peer for `@daybreak/booking/react` only.

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
| `GET <basePath>/<slug>?from=YYYY-MM-DD&days=7` | the link's page: `{ link, timeZone, firstDay, lastDay, days, suggested }` |
| `POST <basePath>/<slug>` | `{ booked: { start, end, title } }` |

Refusals answer `{ error: { code, message } }`: the deployment's own (`invalid` 400, `not_found` 404, `taken` 409, `too_many` 429, `closed` 503), or `forbidden` 403 when the person check fails and `unavailable` 502 when the deployment doesn't answer. Reads carry `Cache-Control: s-maxage=60` so a CDN shares them; bookings and refusals are never cached. No response carries the deployment's address.

Next.js, `app/api/booking/[[...path]]/route.ts`:

```ts
import { bookingHandler } from "@daybreak/booking";

const handler = bookingHandler({
  url: process.env.DAYBREAK_URL!,
  key: process.env.DAYBREAK_BOOKING_KEY!,
  turnstileSecret: process.env.TURNSTILE_SECRET_KEY, // optional
  basePath: "/api/booking", // the default
});

export { handler as GET, handler as POST };
```

Cloudflare Workers:

```ts
import { bookingHandler } from "@daybreak/booking";

export default {
  fetch(request: Request, env: Env) {
    return bookingHandler({ url: env.DAYBREAK_URL, key: env.DAYBREAK_BOOKING_KEY })(request);
  },
};
```

The handler reads the visitor's address from `x-real-ip`, then `cf-connecting-ip`, then the first entry of `x-forwarded-for`, and sends it beside the key, so the deployment's per-caller limit counts each visitor apart. Behind a proxy that lets visitors set those headers themselves, strip them first.

Without `turnstileSecret`, the handler books without a person check; the deployment's own limits still apply. With it, a POST needs `turnstileToken` in its body, which the page sends when it has `turnstileSiteKey`.

## The page

### React: `@daybreak/booking/react`

```tsx
import { DaybreakBooking } from "@daybreak/booking/react";

export default function Book() {
  return <DaybreakBooking api="/api/booking" slug="meet" turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />;
}
```

| Prop | |
| --- | --- |
| `api` | The proxy's address. Required. |
| `slug` | The link. Without it, the page lists the links. |
| `initial` | The link's first week, read on the server with `createClient(...).page(slug)`, so the page draws without waiting. |
| `turnstileSiteKey` | Shows Cloudflare's widget and sends its token. |
| `heading` | The link's title and a line on how to book. On unless `false`. |
| `theme` | `"auto"` (the default), `"light"`, or `"dark"`. |
| `linkHref` | `(slug) => href` for the list of links. Without it, a link opens in place. |
| `injectStyles` | The component adds its stylesheet to the document. Pass `false` and import `@daybreak/booking/styles.css` yourself to avoid a flash on server-rendered pages. |

### Custom element: `@daybreak/booking/element`

React is bundled inside, so it works on any page:

```html
<script type="module" src="https://unpkg.com/@daybreak/booking@0.1.0/dist/element.js"></script>
<daybreak-booking api="/api/booking" slug="meet"></daybreak-booking>
```

Or `dist/element.global.js` with a plain `<script>`, or `import "@daybreak/booking/element"` in a bundler. Attributes: `api`, `slug`, `turnstile-site-key`, `theme` (`light` or `dark`), `heading="off"`, and `link-href` with `{slug}` in it, as `/book/{slug}`.

It draws in a shadow root, so your page's styles don't reach in. Cloudflare's widget draws in the light DOM and is slotted in.

### Styling

Colors come from Daybreak's First Light tokens as CSS custom properties, with First Light's values as defaults. Set any of them on the element or a parent:

| Property | Used for | Default (light / dark) |
| --- | --- | --- |
| `--fl-accent` | buttons, the picked time, focus | `#0088ff` / `#0091ff` |
| `--fl-on-accent` | words on the accent | `#ffffff` |
| `--fl-running` | open time, the done check | `#28b44b` / `#2dbf50` |
| `--fl-sun` | the times best for the host | `#ff9e47` |
| `--fl-today-red` | errors | `#ff3b30` / `#e03c33` |
| `--fl-ground-schedule` | inputs and outlined buttons | `#ffffff` / `#141518` |

The grays aren't First Light tokens: `--dbk-text`, `--dbk-muted`, `--dbk-line`, `--dbk-card`, and `--dbk-font` (the page's font unless set). The layout follows its own width, not the window's: under 48rem it shows one Day's times as a list, and from 60rem the form sits beside the week.

## The client: `createClient`

For your own server code, such as rendering the first week or an agent's backend. It refuses to run where `window` exists, so a key never ships to a browser.

```ts
import { BookingError, createClient } from "@daybreak/booking";

const daybreak = createClient({ url: process.env.DAYBREAK_URL!, key: process.env.DAYBREAK_BOOKING_KEY });

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

Types (`BookingPage`, `BookingRequest`, `Booked`, and the rest) are generated from the API's OpenAPI document, which ships at `@daybreak/booking/openapi.json`. A deployment serves its own at `GET /book/v1/openapi.json`.

## License

MIT. The icons are from [Phosphor](https://phosphoricons.com), MIT.
