// Writes src/api.gen.ts from fixtures/openapi.json, Daybreak's OpenAPI
// document of the Booking API. Run it after Daybreak's sync script copies a
// new document in; `npm test` fails while the file is stale.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";

const root = new URL("..", import.meta.url);
const target = fileURLToPath(new URL("src/api.gen.ts", root));

export async function generatedTypes() {
  const document = JSON.parse(await readFile(new URL("fixtures/openapi.json", root), "utf8"));
  const ast = await openapiTS(document);
  return `// Generated from fixtures/openapi.json by \`npm run generate\`. Don't edit it here.\n\n${astToString(ast)}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await writeFile(target, await generatedTypes());
  console.log("Wrote src/api.gen.ts");
}
