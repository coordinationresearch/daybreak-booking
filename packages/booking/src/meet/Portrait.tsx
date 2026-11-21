"use client";

import { type CSSProperties, forwardRef } from "react";

import { initials, useMeetHost } from "./host";

type Props = {
  /** The size it's drawn at, as next/image's width and height on /meet. */
  size: number;
  className?: string;
  style?: CSSProperties;
  "data-enter"?: boolean;
};

/**
 * The host's photo where /meet draws its own (next/image of a file on the
 * site), from the page's `photo`. With none, the host's initials on the
 * accent, in the same box, so the ring, the intro, and the ticket move
 * the same.
 */
export const Portrait = forwardRef<HTMLElement, Props>(function Portrait({ size, className, style, ...rest }, ref) {
  const { photo, name } = useMeetHost();
  if (photo)
    return (
      <img
        ref={ref as React.Ref<HTMLImageElement>}
        src={photo}
        alt=""
        width={size}
        height={size}
        decoding="async"
        draggable={false}
        // next/image's own, so a photo that hasn't loaded shows no alt text.
        style={{ color: "transparent", ...style }}
        className={className}
        {...rest}
      />
    );
  return (
    <span
      ref={ref as React.Ref<HTMLSpanElement>}
      aria-hidden
      style={{ ["--dbk-size" as string]: `${size}px`, ...style }}
      className={["dbk-monogram", className].filter(Boolean).join(" ")}
      {...rest}
    >
      <span>{initials(name)}</span>
    </span>
  );
});
