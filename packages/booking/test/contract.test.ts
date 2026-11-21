// fixtures/openapi.json and fixtures/booking-api/cases.json come from
// Daybreak together. A sync that brought one without the other fails here:
// every case's route, method, and status must be in the OpenAPI document.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CASES } from "./support/fake-deployment.js";

type Operation = { responses?: Record<string, unknown> };
const OPENAPI = JSON.parse(readFileSync(new URL("../fixtures/openapi.json", import.meta.url), "utf8")) as {
  paths: Record<string, Record<string, Operation>>;
};

/** The OpenAPI path template a concrete path matches, as `/book/v1/{slug}` for `/book/v1/meet`. */
function templateOf(path: string): string | undefined {
  const segments = path.split("/");
  const matches = Object.keys(OPENAPI.paths).filter((template) => {
    const parts = template.split("/");
    return parts.length === segments.length && parts.every((part, i) => part === segments[i] || /^\{.+\}$/.test(part));
  });
  // A literal segment wins over a parameter: `/book/v1/key` over `/book/v1/{slug}`.
  return matches.sort((a, b) => (a.match(/\{/g)?.length ?? 0) - (b.match(/\{/g)?.length ?? 0))[0];
}

describe("the contract's two halves", () => {
  for (const c of CASES) {
    it(`has ${c.name}'s route and status in the OpenAPI document`, () => {
      const path = new URL(c.request.path, "https://example.com").pathname;
      const template = templateOf(path);
      expect(template, `no OpenAPI path for ${path}`).toBeDefined();
      const operation = OPENAPI.paths[template!]![c.request.method.toLowerCase()];
      expect(operation, `no ${c.request.method} ${template}`).toBeDefined();
      expect(Object.keys(operation!.responses ?? {})).toContain(String(c.response.status));
    });
  }

  it("covers every operation the document has with at least one case", () => {
    for (const [template, operations] of Object.entries(OPENAPI.paths)) {
      for (const method of Object.keys(operations).filter((m) => ["get", "post"].includes(m))) {
        const covered = CASES.some(
          (c) => c.request.method.toLowerCase() === method && templateOf(new URL(c.request.path, "https://example.com").pathname) === template,
        );
        expect(covered, `no case for ${method.toUpperCase()} ${template}`).toBe(true);
      }
    }
  });
});
