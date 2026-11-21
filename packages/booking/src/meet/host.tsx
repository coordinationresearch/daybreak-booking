"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

/**
 * What the page knows about where it's drawn, which /meet took from its
 * own site: the host's photo, the way back to the host's site, and the
 * resolved light or dark (next-themes' `resolvedTheme` on /meet).
 */
export type MeetHost = {
  /** The host's photo, square. Without it, the host's initials stand in its place. */
  photo?: string;
  /** The host's name, for the initials. */
  name?: string;
  /** The quiet way out, to the host's site, as the ticket's back link. */
  home?: { href: string; label: string };
  theme: "light" | "dark";
};

export const MeetHostContext = createContext<MeetHost>({ theme: "light" });

export const useMeetHost = () => useContext(MeetHostContext);

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemDark() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
}

function subscribeSystem(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener?.("change", onChange);
  return () => query.removeEventListener?.("change", onChange);
}

/** "auto" follows the system's light or dark, as /meet's "system" theme does. */
export function useResolvedTheme(theme: "auto" | "light" | "dark"): "light" | "dark" {
  const dark = useSyncExternalStore(subscribeSystem, systemDark, () => false);
  return theme === "auto" ? (dark ? "dark" : "light") : theme;
}

/** "SL" for Sam Lee, "A" for Ana: the face when there's no photo. */
export function initials(name: string | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0]!, words.at(-1)!] : words.slice(0, 1);
  return letters.map((word) => [...word][0]!.toUpperCase()).join("");
}
