import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // tsconfig.json's paths: the booking page keeps /meet's own imports.
  resolve: {
    alias: [
      { find: /^~\/lib\/booking\/(.*)$/, replacement: at("./src/page/$1") },
      { find: /^~\/lib\/utils$/, replacement: at("./src/meet/ui/utils") },
      { find: /^~\/lib\/useTapFirstCapability$/, replacement: at("./src/meet/ui/useTapFirstCapability") },
      { find: /^~\/components\/ui\/(.*)$/, replacement: at("./src/meet/ui/$1") },
    ],
  },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    // The booking page's tests type and press through a whole form, and
    // jsdom is slow on a busy machine.
    testTimeout: 20_000,
  },
});
