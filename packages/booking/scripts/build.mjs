// Builds dist/:
// - the server side (client, handler, types) with tsc;
// - the booking page's stylesheet: Tailwind's classes that src/meet uses
//   (tailwind.config.cjs), then src/meet/globals.css, meet.css, and its CSS
//   modules, as /meet's site loads them, with Tailwind's reset moved from
//   <html> and <body> onto the page's own box (.dbk-meet);
// - dist/react/index.js, the component, with React, framer-motion, Radix,
//   and Phosphor left to the site, and dist/element.js and
//   dist/element.global.js, the custom element with all of it inside;
//   each carries the stylesheet as a string;
// - their declarations with tsc, and dist/styles.css.
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import { build, transform } from "esbuild";
import postcss from "postcss";
import tailwind from "tailwindcss";

import { generatedTypes } from "./generate-types.mjs";

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url);
const at = (path) => new URL(path, root).pathname;

const current = await readFile(at("src/api.gen.ts"), "utf8");
if (current !== (await generatedTypes())) {
  console.error("src/api.gen.ts is stale: run `npm run generate` after the OpenAPI document changes.");
  process.exit(1);
}

await rm(at("dist"), { recursive: true, force: true });
const tsc = require.resolve("typescript/bin/tsc");
execFileSync(process.execPath, [tsc, "-p", "tsconfig.build.json"], { cwd: at("."), stdio: "inherit" });
execFileSync(process.execPath, [tsc, "-p", "tsconfig.types.json"], { cwd: at("."), stdio: "inherit" });

// ---------- The stylesheet ----------

const config = require(at("scripts/tailwind.config.cjs"));
const tw = async (input) => (await postcss([tailwind(config)]).process(input, { from: undefined })).css;

/** Splits a selector list at its top-level commas. */
function selectors(list) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      parts.push(list.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(list.slice(start).trim());
  return parts;
}

/**
 * Tailwind's reset, on the page's box and what's inside it: `html` and
 * `:host` become `.dbk-meet`, `body`'s rule goes (it only inherits from
 * them), and every other selector looks only inside it, at the same specificity (`:where`), so Tailwind's classes
 * and /meet's modules win over it just as they do on /meet.
 */
const scopeReset = {
  postcssPlugin: "dbk-scope-reset",
  Rule(rule) {
    if (rule.parent?.type === "atrule" && /keyframes/.test(rule.parent.name)) return;
    if (rule.selector.includes(".dbk-meet")) return;
    const scoped = selectors(rule.selector).flatMap((part) => {
      if (part === "html" || part === ":host") return [".dbk-meet"];
      // <body> only inherits <html>'s line height, which the box has itself.
      if (part === "body") return [];
      if (part === "::backdrop") return [part];
      return [`:where(.dbk-meet) ${part}`];
    });
    if (scoped.length === 0) rule.remove();
    else rule.selector = [...new Set(scoped)].join(",\n");
  },
};

const base = (await postcss([scopeReset]).process(await tw("@tailwind base;"), { from: undefined })).css;
const classes = await tw("@tailwind components;\n@tailwind utilities;");
const globals = await readFile(at("src/meet/globals.css"), "utf8");
const meet = await readFile(at("src/meet/meet.css"), "utf8");

// Identifiers stay whole in the bundle: CSS modules' names (keyframes
// included) keep their own words, which the intro dust reads to find the
// page's entrances (MeetDust's ENTRANCES). The JavaScript is minified again
// on its own, which leaves strings alone.
const bundled = {
  bundle: true,
  minifyWhitespace: true,
  minifySyntax: true,
  target: "es2022",
  legalComments: "eof",
  logLevel: "warning",
  loader: { ".module.css": "local-css" },
  jsx: "automatic",
};

// The modules' CSS, from the same files the bundles import, so their class names match.
const probe = await build({
  ...bundled,
  entryPoints: [at("src/element/index.ts")],
  format: "esm",
  outdir: at("dist/.probe"),
  write: false,
  define: { "process.env.NODE_ENV": '"production"' },
});
const modules = probe.outputFiles.filter((file) => file.path.endsWith(".css")).map((file) => file.text).join("\n");

const { code: MEET_CSS } = await transform([base, globals, classes, meet, modules].join("\n"), {
  loader: "css",
  minify: true,
  logLevel: "warning",
});

const define = {
  "process.env.NODE_ENV": '"production"',
  __DAYBREAK_BOOKING_MEET_CSS__: JSON.stringify(MEET_CSS),
};

/** Builds and writes only the JavaScript; the stylesheet travels inside it. */
async function bundle(options) {
  const result = await build({ ...bundled, ...options, define, write: false });
  for (const file of result.outputFiles) {
    if (file.path.endsWith(".css")) continue;
    await mkdir(new URL(".", `file://${file.path}`).pathname, { recursive: true });
    const { code } = await transform(file.text, {
      loader: "js",
      minify: true,
      target: "es2022",
      legalComments: "eof",
      ...(options.format === "esm" ? { format: "esm" } : {}),
    });
    await writeFile(file.path, code);
  }
}

const element = { entryPoints: [at("src/element/index.ts")] };
await bundle({ ...element, format: "esm", outfile: at("dist/element.js") });
await bundle({ ...element, format: "iife", outfile: at("dist/element.global.js") });
await bundle({
  entryPoints: [at("src/react/index.ts")],
  format: "esm",
  outfile: at("dist/react/index.js"),
  external: [
    "react",
    "react-dom",
    "react/*",
    "react-dom/*",
    "framer-motion",
    "@radix-ui/*",
    "@phosphor-icons/react",
    "clsx",
    "tailwind-merge",
    "class-variance-authority",
  ],
  banner: { js: '"use client";' },
});

const { BOOKING_CSS } = await import(at("dist/react/index.js"));
await writeFile(at("dist/styles.css"), `/* @coordination/booking's stylesheet, the same one the components add themselves. */\n${BOOKING_CSS.trimStart()}`);

const size = async (path) => {
  const file = await readFile(at(path));
  return `${(file.length / 1024).toFixed(0)} KB, ${(gzipSync(file).length / 1024).toFixed(0)} KB gzipped`;
};
console.log(
  `Built dist/. element.global.js: ${await size("dist/element.global.js")}; react/index.js: ${await size("dist/react/index.js")}; stylesheet ${(MEET_CSS.length / 1024).toFixed(0)} KB.`,
);
