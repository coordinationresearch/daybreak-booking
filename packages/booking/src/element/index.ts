import { createElement } from "react";
import { type Root, createRoot } from "react-dom/client";

import { DaybreakBooking } from "../react/DaybreakBooking.js";
import { BOOKING_CSS } from "../react/styles.js";
import { TurnstileHostContext } from "../react/Turnstile.js";

/**
 * `<daybreak-booking api="/api/booking" slug="meet">`: the booking page as a
 * custom element, React bundled inside, for pages that aren't React: the
 * Daybreak site's `/u/` pages, an iframe, or a no-code site's HTML block.
 *
 * Attributes:
 * - `api` (required): the proxy, `bookingHandler`'s mount or the site's `/api/u/<name>`.
 * - `slug`: the link. Without it, the element lists the links.
 * - `turnstile-site-key`: Cloudflare Turnstile's site key, when the proxy checks one.
 * - `theme`: `light` or `dark`; the system's unless set.
 * - `heading`: `off` hides the link's title and the line under it.
 * - `link-href`: where each listed link goes, with `{slug}` in it, as `/u/sam/{slug}`.
 *
 * It draws in a shadow root, so a page's own styles don't reach in, while
 * the `--fl-*` and `--dbk-*` custom properties do. Cloudflare's widget draws
 * in the light DOM and is slotted in.
 */
export class DaybreakBookingElement extends HTMLElement {
  static observedAttributes = ["api", "slug", "turnstile-site-key", "theme", "heading", "link-href"];

  #root: Root | null = null;
  #turnstileHost: HTMLElement | null = null;

  connectedCallback() {
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    if (!this.#root) {
      adoptStyles(shadow);
      const mount = document.createElement("div");
      shadow.appendChild(mount);
      this.#root = createRoot(mount);
    }
    this.#render();
  }

  disconnectedCallback() {
    // A move within the page disconnects and reconnects in one task; unmount
    // only when the element has really left.
    queueMicrotask(() => {
      if (this.isConnected) return;
      this.#root?.unmount();
      this.#root = null;
      this.shadowRoot?.replaceChildren();
    });
  }

  attributeChangedCallback() {
    if (this.#root) this.#render();
  }

  #render() {
    const api = this.getAttribute("api");
    if (!api || !this.#root) return;
    const siteKey = this.getAttribute("turnstile-site-key") ?? undefined;
    if (siteKey && !this.#turnstileHost) {
      this.#turnstileHost = document.createElement("div");
      this.#turnstileHost.slot = "turnstile";
      this.appendChild(this.#turnstileHost);
    }
    const theme = this.getAttribute("theme");
    const template = this.getAttribute("link-href");
    const slug = this.getAttribute("slug") ?? undefined;
    this.#root.render(
      createElement(
        TurnstileHostContext.Provider,
        { value: siteKey ? this.#turnstileHost : null },
        createElement(DaybreakBooking, {
          api,
          ...(slug ? { slug } : {}),
          ...(siteKey ? { turnstileSiteKey: siteKey } : {}),
          theme: theme === "light" || theme === "dark" ? theme : "auto",
          heading: this.getAttribute("heading") !== "off",
          injectStyles: false,
          ...(template ? { linkHref: (s: string) => template.replaceAll("{slug}", encodeURIComponent(s)) } : {}),
        }),
      ),
    );
  }
}

function adoptStyles(shadow: ShadowRoot) {
  const host = ":host { display: block; }\n";
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(host + BOOKING_CSS);
    shadow.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement("style");
    style.textContent = host + BOOKING_CSS;
    shadow.appendChild(style);
  }
}

/** Registers the element under `tag`, `daybreak-booking` unless given. Importing this module already registers the default. */
export function defineDaybreakBooking(tag = "daybreak-booking") {
  if (typeof customElements !== "undefined" && !customElements.get(tag)) {
    customElements.define(tag, class extends DaybreakBookingElement {});
  }
}

defineDaybreakBooking();

declare global {
  interface HTMLElementTagNameMap {
    "daybreak-booking": DaybreakBookingElement;
  }
}
