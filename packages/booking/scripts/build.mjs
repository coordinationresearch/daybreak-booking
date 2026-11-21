// Builds dist/: the library with tsc (React stays a peer), the element
// bundled with React inside (dist/element.js as a module, and
// dist/element.global.js for a plain <script> tag), and dist/styles.css.
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";

import { generatedTypes } from "./generate-types.mjs";

const root = new URL("..", import.meta.url);
const at = (path) => new URL(path, root).pathname;

const current = await readFile(at("src/api.gen.ts"), "utf8");
if (current !== (await generatedTypes())) {
  console.error("src/api.gen.ts is stale: run `npm run generate` after the OpenAPI document changes.");
  process.exit(1);
}

await rm(at("dist"), { recursive: true, force: true });
const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");
execFileSync(process.execPath, [tsc, "-p", "tsconfig.build.json"], { cwd: at("."), stdio: "inherit" });

const shared = {
  entryPoints: [at("src/element/index.ts")],
  bundle: true,
  minify: true,
  target: "es2022",
  legalComments: "eof",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
};
await build({ ...shared, format: "esm", outfile: at("dist/element.js") });
await build({ ...shared, format: "iife", outfile: at("dist/element.global.js") });

const { BOOKING_CSS } = await import(at("dist/react/styles.js"));
await mkdir(at("dist"), { recursive: true });
await writeFile(at("dist/styles.css"), `/* @coordination/booking's stylesheet, the same one the components add themselves. */\n${BOOKING_CSS.trimStart()}`);

const element = await readFile(at("dist/element.js"));
console.log(`Built dist/. element.js: ${(element.length / 1024).toFixed(0)} KB, ${(gzipSync(element).length / 1024).toFixed(0)} KB gzipped.`);
