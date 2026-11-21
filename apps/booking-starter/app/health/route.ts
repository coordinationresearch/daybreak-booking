// GET /health: whether the booking key works, for an uptime check or a look after deploying.
// 200 when the deployment takes the key, 503 otherwise, with a reason. It never shows the key or
// the deployment's address, and it doesn't book or read anyone's open time.
import { BookingError } from "@coordination/booking";
import { daybreak, missing, turnstile } from "../../lib/daybreak";

export const dynamic = "force-dynamic";

const answer = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function GET(): Promise<Response> {
  const unset = missing();
  if (unset.length > 0) {
    return answer(503, { ok: false, reason: "missing", missing: unset, message: `Set ${unset.join(" and ")} in the project's environment.` });
  }
  let live: boolean;
  try {
    live = await daybreak().checkKey();
  } catch (error) {
    if (error instanceof BookingError) {
      return answer(503, { ok: false, reason: "unreachable", message: "The deployment didn't answer the key check. Check DAYBREAK_URL is your deployment's HTTP actions address, ending in .convex.site." });
    }
    return answer(503, { ok: false, reason: "bad_url", message: "DAYBREAK_URL isn't an https address." });
  }
  if (!live) {
    return answer(503, { ok: false, reason: "revoked", message: "The deployment doesn't know this booking key, or it was revoked. Make a new one in Daybreak's Settings › Booking › Website keys." });
  }
  const check = turnstile();
  if (check === "half") {
    return answer(503, { ok: false, reason: "turnstile", turnstile: check, message: "Set both TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY, or neither." });
  }
  return answer(200, { ok: true, turnstile: check });
}
