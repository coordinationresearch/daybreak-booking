# Daybreak booking starter

A small Next.js site that shows your Daybreak Booking links and books them, on your own domain. Deploy it as it is, or change it: it's yours.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fchappyasel%2Fdaybreak-booking&root-directory=apps%2Fbooking-starter&project-name=booking&env=DAYBREAK_URL,DAYBREAK_BOOKING_KEY&envDescription=Your%20deployment%27s%20HTTP%20actions%20address%20and%20a%20booking%20key%20from%20Daybreak%27s%20Settings%20%E2%80%BA%20Booking%20%E2%80%BA%20Website%20keys&envLink=https%3A%2F%2Fgithub.com%2Fchappyasel%2Fdaybreak-booking%2Ftree%2Fmain%2Fapps%2Fbooking-starter%23settings)

## What it serves

| Address | |
| --- | --- |
| `/` | Your listed links. Each opens at `/<slug>`. |
| `/<slug>` | One link's page: open times, lengths, and the booking form. Its first week is read on the server, and Next keeps the page for 60 seconds. A private link works here too, by its slug. |
| `/api/booking/...` | The proxy the page calls, from `bookingHandler`. It holds your key and forwards each visitor's address, so the deployment counts visitors apart. |
| `/health` | Whether your key works: `200 {"ok":true}`, or `503` with a `reason` (`missing`, `bad_url`, `unreachable`, `revoked`, or `turnstile`). It never shows the key or your deployment's address. Point an uptime check at it. |

A link whose slug is `health` or `api` is hidden behind those routes; give it another slug.

## Settings

| Variable | |
| --- | --- |
| `DAYBREAK_URL` | Your deployment's HTTP actions address, `https://your-deployment.convex.site`: the Deployment URL your Mac connected to, with `.convex.cloud` changed to `.convex.site`. |
| `DAYBREAK_BOOKING_KEY` | A booking key: in Daybreak, Settings › Booking › Website keys › New Key…. It's shown once. Revoke it there to cut this site off. |
| `TURNSTILE_SECRET_KEY` | Optional. A [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) widget's secret, so bots can't book. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Optional. The same widget's site key. Set both Turnstile keys or neither; `/health` says when only one is set. |

Without Turnstile, anyone can book without a person check, and only your deployment's own limits apply: 3 bookings an hour from one visitor, 2 upcoming per email, and 20 a day in all. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is built into the page, so redeploy after changing it.

You need at least one listed Booking link, from Settings › Booking › Links, for `/` to show anything.

## Deploy

1. Press Deploy with Vercel above. Vercel copies this repo to your GitHub account and builds `apps/booking-starter`.
2. Enter `DAYBREAK_URL` and `DAYBREAK_BOOKING_KEY` when Vercel asks. Add the Turnstile keys under the project's Settings › Environment Variables if you want them, then redeploy.
3. Open `/health` on the new address. `{"ok":true}` means the site reaches your deployment with that key.

On Vercel, the proxy reads each visitor's address from `x-real-ip`, which Vercel sets itself. On another host that runs Next.js, pass `clientAddress` to `bookingHandler` in `lib/daybreak.ts`, as the package's README says under The visitor's address. Without it, every visitor shares one limit.

## Run it locally

```sh
npm install                       # from the repo's root
cp apps/booking-starter/.env.example apps/booking-starter/.env.local   # then fill it in
npm run dev -w booking-starter
```

`npm run dev` and `npm run build` build `packages/booking` first, since the starter uses the copy in this repo. To use the published package instead, in a copy of `apps/booking-starter` on its own, delete the `predev` and `prebuild` scripts and the two root settings in `next.config.mjs`, and install `@daybreak/booking` from npm.

## Change it

- `app/Booking.tsx` draws the page with `DaybreakBooking` from `@daybreak/booking/react`. Its props (`heading`, `theme`, `linkHref`, and the rest) are in [the package's README](../../packages/booking/README.md#react-daybreakbookingreact).
- `app/globals.css` styles the page around it. The component's colors are CSS variables you can set: see the package README's Styling.
- `lib/daybreak.ts` holds the server's side: the client and the proxy. Nothing there may reach the browser.

## Cloudflare Workers

The proxy needs no Next.js: `bookingHandler` is a `(Request) => Response` that runs on Workers as it is, reading the visitor's address from `cf-connecting-ip`. Serve it at `/api/booking/*` from a Worker, and put the page on any site with the `<daybreak-booking>` element. [The package's README](../../packages/booking/README.md#the-proxy-bookinghandler) has the Worker's code and the element's tag.

## License

MIT.
