import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Fails the build when he.json and en.json key sets diverge. */
const i18nDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "i18n");

const he = JSON.parse(readFileSync(join(i18nDir, "he.json"), "utf8")) as Record<string, string>;
const en = JSON.parse(readFileSync(join(i18nDir, "en.json"), "utf8")) as Record<string, string>;

const heKeys = new Set(Object.keys(he));
const enKeys = new Set(Object.keys(en));

const missingInEn = [...heKeys].filter((k) => !enKeys.has(k));
const missingInHe = [...enKeys].filter((k) => !heKeys.has(k));

if (missingInEn.length > 0 || missingInHe.length > 0) {
  if (missingInEn.length > 0) console.error(`missing in en.json: ${missingInEn.join(", ")}`);
  if (missingInHe.length > 0) console.error(`missing in he.json: ${missingInHe.join(", ")}`);
  process.exit(1);
}

console.log(`i18n parity OK (${heKeys.size} keys)`);
