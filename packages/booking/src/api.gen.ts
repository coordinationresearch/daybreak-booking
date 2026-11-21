// Generated from fixtures/openapi.json by `npm run generate`. Don't edit it here.

export interface paths {
    "/book/v1": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The listed links, how to book, and the API's version. */
        get: operations["links"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/book/v1/key": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Whether a booking key is live. */
        get: operations["checkKey"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/book/v1/photo.jpg": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The host's photo, a square JPEG, while they show it on their pages. */
        get: operations["photo"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/book/v1/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** A link's open time, Day by Day, and the starts best for the host. */
        get: operations["page"];
        put?: never;
        /** Books a time. Google emails the invite to the booker and their guests. */
        post: operations["book"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Index: {
            /** @constant */
            api: 1;
            /** @description The Release or commit the deployment runs, or "dev". */
            backendVersion: string;
            links: components["schemas"]["ListedLink"][];
            /** @description The routes in words, for an agent. */
            howToBook: string[];
        };
        ListedLink: {
            slug: string;
            title: string;
            /** @description Minutes. */
            lengths: number[];
        };
        Link: {
            slug: string;
            title: string;
            host: string;
            /** @description Minutes. */
            lengths: number[];
            defaultLength: number;
            /** @description Where it meets. A place's `location` shows; a call link's address reaches only the invite. */
            call: {
                /** @enum {unknown} */
                kind: "meet" | "link" | "place";
                location?: string;
            };
        };
        Page: {
            link: components["schemas"]["Link"];
            /** @description The host's Home time zone, an IANA name. */
            timeZone: string;
            /** @description A Day, YYYY-MM-DD, in the host's Home time zone. */
            firstDay: string;
            /** @description A Day, YYYY-MM-DD, in the host's Home time zone. */
            lastDay: string;
            days: {
                /** @description A Day, YYYY-MM-DD, in the host's Home time zone. */
                day: string;
                open: {
                    /** @description Milliseconds since epoch. */
                    start: number;
                    /** @description Milliseconds since epoch. */
                    end: number;
                }[];
            }[];
            /** @description Up to 3 starts a week best for the host, at the default length. */
            suggested: number[];
            /** @description The hex SHA-256 of the host's photo, which `GET /book/v1/photo.jpg` serves, while they show one. Absent otherwise. */
            photoHash?: string;
        };
        BookingRequest: {
            /** @description Milliseconds since epoch, on the quarter hour, inside one open stretch. */
            start: number;
            /** @description Minutes, one of the link's lengths. */
            length: number;
            name: string;
            email: string;
            /** @description What it's about, one line of up to 200 characters, never a web address. */
            about?: string;
            /** @description A linkedin.com address. */
            linkedin?: string;
            /** @description With + and the country code outside the US. */
            phone?: string;
            /** @description Up to 5, each invited too. */
            guests?: {
                email: string;
                name?: string;
            }[];
            /** @description Up to 40 characters, which the event's title leads with. */
            meetingName?: string;
            /** @description The booker's own ID for this booking, the same on a retry, which then answers the first booking. */
            requestId?: string;
        };
        Booked: {
            booked: {
                /** @description Milliseconds since epoch. */
                start: number;
                /** @description Milliseconds since epoch. */
                end: number;
                title: string;
            };
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    links: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The listed links. None while the host has paused bookings. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Index"];
                };
            };
        };
    };
    checkKey: {
        parameters: {
            query?: never;
            header: {
                /** @description A booking key, a `booking` Device's token, which a website's server holds. A live key counts its callers apart for the per-caller limit, by `X-Daybreak-Booking-Client`. Without one, or with an unknown or revoked one, a call shares the direct limit of 5 bookings a day. */
                "X-Daybreak-Booking-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The key is live. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        ok: true;
                    };
                };
            };
            /** @description No key, or an unknown or revoked one. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: {
                            /** @constant */
                            code: "unauthenticated";
                            message: string;
                        };
                    };
                };
            };
        };
    };
    photo: {
        parameters: {
            query?: never;
            header?: {
                /** @description The ETag a cache holds, the photo's hash in quotes. */
                "If-None-Match"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The photo. Its `ETag` is its hex SHA-256 in quotes, the page's `photoHash`. */
            200: {
                headers: {
                    ETag?: string;
                    [name: string]: unknown;
                };
                content: {
                    "image/jpeg": string;
                };
            };
            /** @description The photo is the one `If-None-Match` names. */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The host shows no photo, has none, or has paused bookings. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: {
                            /** @constant */
                            code: "not_found";
                            message: string;
                        };
                    };
                };
            };
        };
    };
    page: {
        parameters: {
            query?: {
                /** @description The first Day to read. Days before the first bookable one are skipped. */
                from?: string;
                /** @description How many Days to read, 1 to 28, 7 unless given. */
                days?: number;
            };
            header?: {
                /** @description A booking key, a `booking` Device's token, which a website's server holds. A live key counts its callers apart for the per-caller limit, by `X-Daybreak-Booking-Client`. Without one, or with an unknown or revoked one, a call shares the direct limit of 5 bookings a day. */
                "X-Daybreak-Booking-Key"?: string;
                /** @description The address of the visitor a website's server books for, beside its booking key. */
                "X-Daybreak-Booking-Client"?: string;
            };
            path: {
                /** @description The Booking link's address. */
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The link's page. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page"];
                };
            };
            /** @description `from` isn't a Day. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: {
                            /** @constant */
                            code: "invalid";
                            message: string;
                        };
                    };
                };
            };
            /** @description No link has that address, or it's off. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: {
                            /** @constant */
                            code: "not_found";
                            message: string;
                        };
                    };
                };
            };
            /** @description The host has paused bookings. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: {
                            /** @constant */
                            code: "closed";
                            message: string;
                        };
                    };
                };
            };
        };
    };
    book: {
        parameters: {
            query?: never;
            header?: {
                /** @description A booking key, a `booking` Device's token, which a website's server holds. A live key counts its callers apart for the per-caller limit, by `X-Daybreak-Booking-Client`. Without one, or with an unknown or revoked one, a call shares the direct limit of 5 bookings a day. */
                "X-Daybreak-Booking-Key"?: string;
                /** @description The address of the visitor a website's server books for, beside its booking key. */
                "X-Daybreak-Booking-Client"?: string;
            };
            path: {
                /** @description The Booking link's address. */
                slug: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BookingRequest"];
            };
        };
        responses: {
            /** @description Booked. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Booked"];
                };
            };
            /** @description A field is missing or doesn't read, or the request ID was used for another booking. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: {
                            /** @constant */
                            code: "invalid";
                            message: string;
                        };
                    };
                };
            };
            /** @description No link has that address, or it's off. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: {
                            /** @constant */
                            code: "not_found";
                            message: string;
                        };
                    };
                };
            };
            /** @description The time isn't open anymore. Pick another. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: {
                            /** @constant */
                            code: "taken";
                            message: string;
                        };
                    };
                };
            };
            /** @description Too many bookings from this caller, this address, or for the host today. Try again later. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: {
                            /** @constant */
                            code: "too_many";
                            message: string;
                        };
                    };
                };
            };
            /** @description The host has paused bookings, or can't take them right now. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: {
                            /** @constant */
                            code: "closed";
                            message: string;
                        };
                    };
                };
            };
        };
    };
}
