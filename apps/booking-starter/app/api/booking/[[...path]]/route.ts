// The proxy the page calls: GET /api/booking, GET /api/booking/<slug>, and POST /api/booking/<slug>.
// `bookingHandler` holds the key, checks Turnstile when it's set up, and forwards the visitor's
// address; on Vercel it reads that from x-real-ip, which Vercel sets itself. See the package's README.
import { bookingProxy } from "../../../../lib/daybreak";

async function handle(request: Request): Promise<Response> {
  let serve: (request: Request) => Promise<Response>;
  try {
    serve = bookingProxy();
  } catch (error) {
    // The package's own words, which name the variable and never its value.
    console.error(error instanceof Error ? error.message : "The booking proxy couldn't start.");
    return Response.json(
      { error: { code: "closed", message: "This booking page isn't set up yet." } },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  return serve(request);
}

export { handle as GET, handle as POST };
