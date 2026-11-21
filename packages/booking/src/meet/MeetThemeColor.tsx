"use client";

import { useEffect } from "react";

import { useMeetHost } from "./host";

const MEET_COLOR = { light: "#f5f5f7", dark: "#0e0e0f" };

function metas() {
  return [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
}

function paint(dark: boolean) {
  for (const meta of metas()) {
    meta.content = dark ? MEET_COLOR.dark : MEET_COLOR.light;
  }
}

/**
 * Browser chrome in the page's grey or near-black rather than the site's
 * own colour. On /meet the site's ThemeColorSync paints after this effect
 * (parents run theirs after children), so this paints on the next frame;
 * here the site's own colours are whatever its metas held, and they're
 * given back when the page goes.
 */
export function MeetThemeColor() {
  const { theme } = useMeetHost();
  const dark = theme === "dark";

  useEffect(() => {
    const before = metas().map((meta) => [meta, meta.content] as const);
    const frame = requestAnimationFrame(() => paint(dark));
    return () => {
      cancelAnimationFrame(frame);
      for (const [meta, content] of before) meta.content = content;
    };
  }, [dark]);

  return null;
}
