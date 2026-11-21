import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The repo's root, where npm installs the workspace and links @coordination/booking.
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import("next").NextConfig} */
export default {
  outputFileTracingRoot: root,
  turbopack: { root },
};
