import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Pool } from "pg";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");

/** Plain numbered SQL migrations, applied in order on boot. */
export async function runMigrations(pool: Pool): Promise<string[]> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = await pool.connect();
  const applied: string[] = [];
  try {
    // Serialize migration runners across replicas (Railway can boot two
    // instances during a deploy). Session-scoped; released on disconnect.
    await client.query("select pg_advisory_lock(823764001)");
    await client.query(
      `create table if not exists vc_migrations (
         name text primary key,
         applied_at timestamptz not null default now()
       )`,
    );
    for (const file of files) {
      const { rowCount } = await client.query("select 1 from vc_migrations where name = $1", [file]);
      if (rowCount) continue;
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into vc_migrations (name) values ($1)", [file]);
        await client.query("commit");
        applied.push(file);
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    await client.query("select pg_advisory_unlock(823764001)").catch(() => undefined);
    client.release();
  }
  return applied;
}
