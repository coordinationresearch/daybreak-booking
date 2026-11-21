import { Fragment } from "react";

/**
 * Text with each number's letters set a step smaller, as /meet draws them:
 * the "rd" of "Nov 23rd", the "p" of "5:30p", the "m" of "30m". The number
 * reads first.
 */
export function Suffixed({ text }: { text: string }) {
  const parts = text.split(/(?<=\d)([a-z]+)\b/);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <span key={index} className="dbk-unit">
            {part}
          </span>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
