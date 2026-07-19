#!/usr/bin/env node
/**
 * Post-build assertion: verify that exactly one `index-<hash>.js` entry file
 * exists in `.output/public/assets/`.
 *
 * Run automatically as part of `npm run build`. Exits with a non-zero code and
 * a clear message when the file is missing so the broken build is caught before
 * it reaches production.
 */

import { readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, "../.output/public/assets");

let files;
try {
  files = readdirSync(assetsDir);
} catch (err) {
  console.error(
    `\n❌  Build check failed: could not read assets directory "${assetsDir}"\n` +
    `   ${err.message}\n` +
    `   Make sure the build completed successfully before running this check.\n`,
  );
  process.exit(1);
}

const entries = files.filter((f) => /^index-[A-Za-z0-9_-]+\.js$/.test(f));

if (entries.length === 0) {
  console.error(
    `\n❌  Build check failed: no client entry file found in "${assetsDir}"\n` +
    `   Expected a file matching index-<hash>.js but none was present.\n` +
    `   This usually means the Vite build did not produce the expected output.\n` +
    `   Check the build logs above for errors.\n`,
  );
  process.exit(1);
}

if (entries.length > 1) {
  console.error(
    `\n❌  Build check failed: found ${entries.length} client entry files in "${assetsDir}":\n` +
    entries.map((f) => `     - ${f}`).join("\n") +
    `\n   Expected exactly one. Multiple candidates cause nondeterministic runtime behavior.\n` +
    `   Clean the output directory and rebuild: rm -rf .output && npm run build\n`,
  );
  process.exit(1);
}

console.log(`✅  Build check passed: client entry file found → ${entries[0]}`);
