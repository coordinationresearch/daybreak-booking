"use client";

// The page itself, from @daybreak/booking/react. It calls only this site's proxy at /api/booking.
// A client component, since `linkHref` is a function and can't cross from the server.
import type { BookingPage } from "@daybreak/booking";
import { DaybreakBooking } from "@daybreak/booking/react";

export function Booking({ slug, initial }: { slug?: string; initial?: BookingPage }) {
  return (
    <DaybreakBooking
      api="/api/booking"
      slug={slug}
      initial={initial}
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined}
      linkHref={(link) => `/${link}`}
      // layout.tsx loads the stylesheet, so the server's HTML is styled before the script runs.
      injectStyles={false}
    />
  );
}
