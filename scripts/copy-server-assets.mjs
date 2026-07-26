import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "server/db/migrations");
const to = join(root, "dist-server/db/migrations");
rmSync(to, { recursive: true, force: true });
mkdirSync(dirname(to), { recursive: true });
cpSync(from, to, { recursive: true });
console.log(`copied migrations → ${to}`);
