import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import { basename, dirname, join } from "node:path";

import { Client } from "pg";

/**
 * Parallel-worktree bootstrap (docs/worktrees.md, CLAUDE.md milestone 2026-07-30).
 *
 *   pnpm worktree new <name>   create ../vetcrew-<name> + branch + .env + DBs
 *   pnpm worktree rm <name>    drop its DBs, remove the worktree, prune
 *   pnpm worktree list         worktrees with slots, ports, DBs, liveness
 *
 * Isolation model: worktrees share the git object store, the pnpm store, one
 * Postgres server, and the Playwright browsers; each has its own node_modules,
 * .env, two databases, and two ports (API = 3001 + slot, web = 5173 + slot;
 * the main checkout is implicitly slot 0 on the defaults).
 *
 * Security rules (frozen in the plan, do not relax):
 *  - The generated .env NEVER contains real Clerk secrets — keyless means the
 *    server boots in its loud dev-bypass mode, which is what agents want.
 *  - DROP DATABASE only ever targets the two names this script itself derives
 *    from the slug. No user-supplied database name is ever dropped.
 */

const BASE_API_PORT = 3001;
const BASE_WEB_PORT = 5173;
const ADMIN_URL =
  process.env["VETCREW_ADMIN_DATABASE_URL"] ?? "postgres://postgres@127.0.0.1:5432/postgres";

function git(args: string[], cwd?: string): string {
  return execFileSync("git", args, { encoding: "utf8", ...(cwd ? { cwd } : {}) }).trim();
}

/** Main checkout root — parent of the shared .git, valid from any worktree. */
const mainRoot = dirname(git(["rev-parse", "--path-format=absolute", "--git-common-dir"]));
const gitCommonDir = git(["rev-parse", "--path-format=absolute", "--git-common-dir"]);

function slugify(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 40);
  if (!/^[a-z0-9][a-z0-9_]*$/.test(slug)) {
    throw new Error(`name "${name}" does not reduce to a usable slug`);
  }
  return slug;
}

/** The only shape a worktree database name may ever take. */
const DB_NAME_RE = /^vetcrew_(e2e_)?test_[a-z0-9][a-z0-9_]*$/;

function dbNames(slug: string): { test: string; e2e: string } {
  // Both contain "test" — required by the server test suites' safety guard.
  return { test: `vetcrew_test_${slug}`, e2e: `vetcrew_e2e_test_${slug}` };
}

/**
 * Postgres cannot parameterise an identifier, so CREATE/DROP DATABASE must
 * interpolate. Two independent guards instead of trusting the caller:
 *  1. the name must match DB_NAME_RE — re-checked HERE, at the point of use, so
 *     the guarantee does not depend on slugify() staying correct elsewhere; and
 *  2. it is then quoted with pg's escapeIdentifier.
 * This is also what makes the safety legible to a scanner, which cannot follow
 * validation across function boundaries.
 */
function safeDbIdentifier(client: Client, name: string): string {
  if (!DB_NAME_RE.test(name)) {
    throw new Error(`refusing to touch database "${name}": not a worktree database name`);
  }
  return client.escapeIdentifier(name);
}

interface WorktreeInfo {
  path: string;
  branch: string | null;
  isMain: boolean;
  slot: number | null;
  name: string | null;
}

function parseEnvSlot(worktreePath: string): number | null {
  const envPath = join(worktreePath, ".env");
  if (!existsSync(envPath)) return null;
  const match = readFileSync(envPath, "utf8").match(/^VETCREW_SLOT=(\d+)$/m);
  return match ? Number(match[1]) : null;
}

function listWorktrees(): WorktreeInfo[] {
  const blocks = git(["worktree", "list", "--porcelain"]).split("\n\n");
  return blocks
    .filter((block) => block.trim() !== "")
    .map((block) => {
      const path = block.match(/^worktree (.+)$/m)?.[1] ?? "";
      const branch = block.match(/^branch refs\/heads\/(.+)$/m)?.[1] ?? null;
      const isMain = path === mainRoot;
      return {
        path,
        branch,
        isMain,
        slot: isMain ? 0 : parseEnvSlot(path),
        name: isMain ? null : basename(path).replace(/^vetcrew-/, ""),
      };
    });
}

/** Lowest free slot >= 1; the worktrees themselves are the registry. */
function allocateSlot(): number {
  const used = new Set(listWorktrees().map((w) => w.slot).filter((s): s is number => s !== null));
  let slot = 1;
  while (used.has(slot)) slot++;
  return slot;
}

/** Atomic mkdir lock so two concurrent `new` runs cannot pick the same slot. */
function withSlotLock<T>(fn: () => T): T {
  const lockPath = join(gitCommonDir, "vetcrew-worktree.lock");
  try {
    mkdirSync(lockPath);
  } catch {
    throw new Error(
      `another worktree operation holds ${lockPath} — if no other run is live, delete that directory and retry`,
    );
  }
  try {
    return fn();
  } finally {
    rmdirSync(lockPath);
  }
}

async function adminClient(): Promise<Client> {
  const client = new Client({ connectionString: ADMIN_URL });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Postgres not reachable at ${ADMIN_URL} — start it or set VETCREW_ADMIN_DATABASE_URL (${String(error)})`,
    );
  }
  return client;
}

function envFile(name: string, slug: string, slot: number): string {
  const admin = new URL(ADMIN_URL);
  const auth = admin.username ? `${admin.username}${admin.password ? `:${admin.password}` : ""}@` : "";
  const host = `${auth}${admin.hostname}:${admin.port || "5432"}`;
  const db = dbNames(slug);
  return `# Generated by scripts/worktree.ts — worktree "${name}", slot ${slot}. Do not commit.
VETCREW_WORKTREE=${name}
VETCREW_SLOT=${slot}

# Ports: API = ${BASE_API_PORT} + slot, web = ${BASE_WEB_PORT} + slot
PORT=${BASE_API_PORT + slot}
VETCREW_WEB_PORT=${BASE_WEB_PORT + slot}

# Dev server + e2e database (migrated on server boot)
DATABASE_URL=postgres://${host}/${db.e2e}
# Integration test database — schema is DROPPED per run (name must contain "test")
TEST_DATABASE_URL=postgres://${host}/${db.test}

# Clerk — deliberately COMMENTED OUT, not set empty. server/env.ts validates
# these as \`z.string().min(1).optional()\`: absent is fine (dev-bypass), but an
# empty string is present-and-invalid and the server refuses to boot. Do not
# "tidy" these into empty assignments. Run \`clerk env pull\` here only if this
# worktree genuinely needs real auth (docs/worktrees.md).
# VITE_CLERK_PUBLISHABLE_KEY=
# CLERK_PUBLISHABLE_KEY=
# CLERK_SECRET_KEY=

# Playwright sets these for the servers it spawns; commented out for the same
# present-but-empty reason, and so a stray value can't widen auth by accident.
# VETCREW_TEST_AUTH=1
# VETCREW_ALLOW_UNREVIEWED_SCORES=1
`;
}

/** Returns true only if this call created the database (false = reused a stale one). */
async function createDb(client: Client, name: string): Promise<boolean> {
  const exists = await client.query("select 1 from pg_database where datname = $1", [name]);
  if ((exists.rowCount ?? 0) > 0) {
    console.warn(`  ! database ${name} already exists (stale from a previous worktree) — reusing`);
    return false;
  }
  await client.query(`create database ${safeDbIdentifier(client, name)}`);
  console.log(`  + created database ${name}`);
  return true;
}

async function cmdNew(name: string): Promise<void> {
  const slug = slugify(name);
  const wtPath = join(dirname(mainRoot), `vetcrew-${name}`);
  const db = dbNames(slug);

  if (existsSync(wtPath)) throw new Error(`${wtPath} already exists`);
  try {
    git(["rev-parse", "--verify", `refs/heads/${name}`]);
    throw new Error(`branch "${name}" already exists — pick another name or delete it first`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) throw error;
    // rev-parse failing is the good case: branch is free.
  }
  const slugTaken = listWorktrees().some((w) => w.name !== null && slugify(w.name) === slug);
  if (slugTaken) throw new Error(`slug "${slug}" collides with an existing worktree`);

  // Preflight BEFORE any mutation, so a dead Postgres leaves nothing behind.
  const client = await adminClient();
  // What THIS invocation created, so a failure can be compensated precisely. A
  // stale database we merely reused is not ours to drop.
  const made = { worktree: false, dbs: [] as string[] };
  try {
    const slot = withSlotLock(() => {
      const s = allocateSlot();
      git(["worktree", "add", wtPath, "-b", name]);
      made.worktree = true;
      writeFileSync(join(wtPath, ".env"), envFile(name, slug, s));
      return s;
    });
    if (await createDb(client, db.test)) made.dbs.push(db.test);
    if (await createDb(client, db.e2e)) made.dbs.push(db.e2e);

    console.log(`  installing dependencies (shared pnpm store)…`);
    execFileSync("pnpm", ["install", "--frozen-lockfile"], { cwd: wtPath, stdio: "inherit" });

    console.log(`
worktree ready:
  path     ${wtPath}
  branch   ${name}
  slot     ${slot}
  api      http://localhost:${BASE_API_PORT + slot}
  web      http://localhost:${BASE_WEB_PORT + slot}
  dbs      ${db.e2e} (dev/e2e) · ${db.test} (integration, dropped per run)

run from inside it:  pnpm dev:server   and   pnpm dev`);
  } catch (error) {
    // Compensate in reverse. Without this, a failed `pnpm install` (stale
    // lockfile, network blip) left the worktree, branch and .env behind, and the
    // obvious retry — `worktree new <same name>` — then failed on "already
    // exists", stranding the user in a state only manual git surgery could fix.
    console.error(`\n  provisioning failed — rolling back what this run created`);
    for (const name of made.dbs) {
      try {
        await client.query(`drop database if exists ${safeDbIdentifier(client, name)} with (force)`);
        console.error(`  - rolled back database ${name}`);
      } catch (cleanupError) {
        console.error(`  ! could not drop ${name}: ${String(cleanupError).split("\n")[0]}`);
      }
    }
    if (made.worktree) {
      // --force because the tree is half-provisioned by definition; the generated
      // .env goes with it.
      try {
        git(["worktree", "remove", "--force", wtPath]);
        git(["worktree", "prune"]);
        console.error(`  - rolled back worktree ${wtPath}`);
      } catch (cleanupError) {
        console.error(`  ! could not remove ${wtPath}: ${String(cleanupError).split("\n")[0]}`);
      }
      try {
        git(["branch", "-D", name]);
        console.error(`  - rolled back branch ${name}`);
      } catch {
        // branch already gone with the worktree, or never created
      }
    }
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Order matters and is the whole point of this function.
 *
 * Databases are dropped only AFTER the worktree is confirmed managed and
 * successfully removed. The reverse order — which this script originally had —
 * destroys data ahead of the check that would have stopped it: `rm` on a worktree
 * with uncommitted work dropped its databases, then `git worktree remove` refused
 * and aborted, leaving a worktree that still existed but could never run again.
 * A mistyped name was the same hazard aimed at whatever slug it happened to hit.
 *
 * So: resolve → verify registered → remove (abort if it fails) → drop → prune.
 * Cleaning up databases whose worktree is already gone is a real need, but it is
 * a different operation and needs `--orphan` to say so out loud.
 */
async function cmdRm(name: string, force: boolean, orphan: boolean): Promise<void> {
  const slug = slugify(name);
  const wtPath = join(dirname(mainRoot), `vetcrew-${name}`);
  const db = dbNames(slug);

  const registered = listWorktrees().find((w) => w.path === wtPath && !w.isMain);

  if (registered === undefined) {
    if (!orphan) {
      throw new Error(
        `no managed worktree at ${wtPath}. Nothing was deleted.\n` +
          `If its databases are left over from a worktree removed by hand, re-run with --orphan ` +
          `to drop ${db.test} and ${db.e2e} without touching git.`,
      );
    }
    console.log(`  (--orphan) no worktree at ${wtPath}; cleaning databases only`);
  } else {
    // Must succeed before anything destructive happens to the databases.
    try {
      git(["worktree", "remove", ...(force ? ["--force"] : []), wtPath]);
      console.log(`  - removed worktree ${wtPath}`);
    } catch (error) {
      throw new Error(
        `git worktree remove failed, so nothing was deleted — databases are intact.\n` +
          `  ${String(error).split("\n")[0]}\n` +
          `Uncommitted work? Commit or stash it, or re-run with --force to discard it.`,
      );
    }
  }

  const client = await adminClient();
  try {
    // WITH (FORCE) terminates live connections (a dev server may still be attached).
    // safeDbIdentifier re-validates the scheme, so a DROP can never reach a name
    // this script did not derive — the Security Master rule from the plan.
    await client.query(`drop database if exists ${safeDbIdentifier(client, db.test)} with (force)`);
    await client.query(`drop database if exists ${safeDbIdentifier(client, db.e2e)} with (force)`);
    console.log(`  - dropped ${db.test}, ${db.e2e} (if they existed)`);
  } finally {
    await client.end();
  }

  git(["worktree", "prune"]);
  try {
    git(["branch", "-d", name]);
    console.log(`  - deleted branch ${name}`);
  } catch {
    console.warn(`  ! branch "${name}" not deleted (unmerged or missing) — delete manually if wanted`);
  }
}

function portListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    const done = (up: boolean) => {
      socket.destroy();
      resolve(up);
    };
    socket.setTimeout(300, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

async function cmdList(): Promise<void> {
  const worktrees = listWorktrees();
  const client = await adminClient().catch(() => null);
  for (const wt of worktrees) {
    if (wt.isMain) {
      console.log(`slot 0  ${wt.path}  [main checkout — defaults ${BASE_API_PORT}/${BASE_WEB_PORT}]`);
      continue;
    }
    const stale = !existsSync(wt.path) ? "  [STALE: directory missing — run worktree rm]" : "";
    const slot = wt.slot;
    let detail = "";
    if (slot !== null && wt.name !== null) {
      const db = dbNames(slugify(wt.name));
      const api = BASE_API_PORT + slot;
      const web = BASE_WEB_PORT + slot;
      const apiUp = await portListening(api);
      const webUp = await portListening(web);
      let dbsUp = "?";
      if (client !== null) {
        const rows = await client.query("select datname from pg_database where datname = any($1)", [
          [db.test, db.e2e],
        ]);
        dbsUp = `${rows.rowCount ?? 0}/2`;
      }
      detail = `  slot ${slot} · api :${api}${apiUp ? " (up)" : ""} · web :${web}${webUp ? " (up)" : ""} · dbs ${dbsUp}`;
    } else {
      detail = "  [no VETCREW_SLOT in .env — not created by this script]";
    }
    console.log(`${wt.branch ?? "(detached)"}  ${wt.path}${detail}${stale}`);
  }
  if (client !== null) await client.end();
}

async function main(): Promise<void> {
  const [command, name] = process.argv.slice(2);
  const force = process.argv.includes("--force");
  switch (command) {
    case "new":
      if (!name) throw new Error("usage: pnpm worktree new <name>");
      await cmdNew(name);
      break;
    case "rm":
      if (!name) throw new Error("usage: pnpm worktree rm <name> [--force] [--orphan]");
      await cmdRm(name, force, process.argv.includes("--orphan"));
      break;
    case "list":
    case undefined:
      await cmdList();
      break;
    default:
      throw new Error(`unknown command "${command}" — use new | rm | list`);
  }
}

main().catch((error: unknown) => {
  console.error(`worktree: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
