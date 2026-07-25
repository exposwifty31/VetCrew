import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Architecture guardrails (CLAUDE.md §8), enforced in CI:
 *  1. engine-is-pure   — packages/engine/src imports nothing outside itself
 *                        (no npm packages, no server, no web, no shared).
 *  2. web-not-server   — src/ never imports server/.
 *  3. server-not-web   — server/ never imports src/.
 * (Replaces dependency-cruiser, which cannot parse TypeScript 7 yet.)
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      out.push(...listTsFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|(?:^|\n)\s*import\s+["']([^"']+)["']/g;

function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specs: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const spec = match[1] ?? match[2];
    if (spec !== undefined) specs.push(spec);
  }
  return specs;
}

const violations: string[] = [];

function check(dir: string, isViolation: (spec: string, file: string) => string | null): void {
  for (const file of listTsFiles(join(repoRoot, dir))) {
    for (const spec of importsOf(file)) {
      const message = isViolation(spec, file);
      if (message !== null) {
        violations.push(`${relative(repoRoot, file)} -> "${spec}": ${message}`);
      }
    }
  }
}

check("packages/engine/src", (spec) => {
  if (spec.startsWith("./") || spec.startsWith("../")) {
    // Relative escapes above src/ would leave the package.
    return spec.startsWith("../") ? "engine-is-pure: relative import escapes engine src" : null;
  }
  return "engine-is-pure: engine must have zero external imports";
});

check("src", (spec, file) => {
  const target = spec.startsWith(".") ? resolve(dirname(file), spec) : spec;
  return typeof target === "string" && target.includes(`${repoRoot}/server`)
    ? "web-not-server: client may not import server code"
    : null;
});

check("server", (spec, file) => {
  const target = spec.startsWith(".") ? resolve(dirname(file), spec) : spec;
  return typeof target === "string" && target.includes(`${repoRoot}/src`)
    ? "server-not-web: server may not import client code"
    : null;
});

if (violations.length > 0) {
  console.error("boundary violations:");
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}

console.log("boundaries OK (engine purity, web/server separation)");
