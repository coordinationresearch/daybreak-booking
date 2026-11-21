"use client";

import { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useRef } from "react";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      appearance: "always" | "execute" | "interaction-only";
      size: "normal" | "flexible" | "compact";
      theme: "auto" | "light" | "dark";
      action?: string;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.turnstile
        ? resolve(window.turnstile)
        : reject(new Error("Turnstile did not load"));
    script.onerror = () => {
      loading = null;
      reject(new Error("Turnstile did not load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export type TurnstileHandle = { reset: () => void };

/**
 * Where the widget draws when the page lives in a shadow root, as
 * `<daybreak-booking>` does: an element in the light DOM, slotted in, since
 * Cloudflare's widget expects to be in the document.
 */
export const TurnstileHostContext = createContext<HTMLElement | null>(null);

/**
 * Cloudflare's person check. It stays invisible unless Cloudflare wants an
 * answer, and hands the page a single-use token; the page resets it after
 * every booking attempt so a retry gets a fresh one.
 */
export const Turnstile = forwardRef<
  TurnstileHandle,
  { siteKey: string; onToken: (token: string | null) => void; theme?: "auto" | "light" | "dark" }
>(function Turnstile({ siteKey, onToken, theme = "auto" }, ref) {
  const own = useRef<HTMLDivElement>(null);
  const host = useContext(TurnstileHostContext);
  const container = { get current() { return host ?? own.current; } };
  const widget = useRef<string | null>(null);
  const tokenHandler = useRef(onToken);
  useEffect(() => {
    tokenHandler.current = onToken;
  });

  useImperativeHandle(ref, () => ({
    reset: () => {
      tokenHandler.current(null);
      if (widget.current && window.turnstile) {
        window.turnstile.reset(widget.current);
      }
    },
  }));

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || !container.current) return;
        widget.current = api.render(container.current, {
          sitekey: siteKey,
          action: "booking",
          appearance: "interaction-only",
          size: "flexible",
          theme,
          callback: (token) => tokenHandler.current(token),
          "expired-callback": () => tokenHandler.current(null),
          "error-callback": () => tokenHandler.current(null),
        });
      })
      .catch(() => tokenHandler.current(null));
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) {
        window.turnstile.remove(widget.current);
      }
      widget.current = null;
    };
    // `container` reads `host` or the div; `host` is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, host, theme]);

  return host ? <slot name="turnstile" /> : <div ref={own} className="dbk-turnstile" />;
});
