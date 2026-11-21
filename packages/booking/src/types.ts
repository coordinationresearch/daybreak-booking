import type { components } from "./api.gen.js";

type Schemas = components["schemas"];

/** What `GET /book/v1` answers: the listed links, how to book, and the API's version. */
export type BookingIndex = Schemas["Index"];
/** A link as `GET /book/v1` lists it. */
export type ListedLink = Schemas["ListedLink"];
/** A link as its page describes it. */
export type BookingLink = Schemas["Link"];
/** A link's page: its words, the host's time zone, each Day's open time, and the starts best for the host. */
export type BookingPage = Schemas["Page"];
export type BookingDay = BookingPage["days"][number];
export type Span = BookingDay["open"][number];
/** The body of `POST /book/v1/<slug>`. */
export type BookingRequest = Schemas["BookingRequest"];
/** What a booking answers. */
export type Booked = Schemas["Booked"]["booked"];

/** Each error code a Booking route answers, with its status, as Daybreak's `BOOKING_ERRORS`. */
export const BOOKING_ERRORS = {
  invalid: 400,
  unauthenticated: 401,
  not_found: 404,
  taken: 409,
  too_many: 429,
  closed: 503,
} as const;

/** A code from the deployment, or one a proxy adds: `forbidden` (the person check) and `unavailable` (the deployment didn't answer). */
export type BookingErrorCode = keyof typeof BOOKING_ERRORS | "forbidden" | "unavailable";

/** Every error's body: `{ error: { code, message } }`. */
export type BookingErrorBody = { error: { code: string; message: string } };

export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;
export const REQUEST_ID = /^[0-9a-v]{20,64}$/;
