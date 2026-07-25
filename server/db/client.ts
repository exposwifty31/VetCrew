import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema/index.js";

export function createDb(databaseUrl: string) {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  // Idle clients can error (network blips, server restarts); without a
  // listener that is an uncaught exception that kills the process.
  pool.on("error", (error) => {
    console.error("pg pool error (idle client):", error.message);
  });
  return { pool, db: drizzle(pool, { schema }) };
}

export type Db = ReturnType<typeof createDb>["db"];
