import { z } from "zod";

/**
 * Env-validation gate at boot (build/deploy plan). In production every
 * secret must be present; in development the server may boot without a DB
 * or Clerk keys (dev-bypass) so the engine and UI are workable standalone.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url().optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  // Declared only so the production gate below can see them. Both are CI/local
  // escape hatches; either one live in production is a complete bypass
  // (VETCREW_TEST_AUTH accepts `Bearer test:anyone:manager`,
  // VETCREW_ALLOW_UNREVIEWED_SCORES scores a real person on unreviewed content).
  VETCREW_TEST_AUTH: z.string().optional(),
  VETCREW_ALLOW_UNREVIEWED_SCORES: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Escape hatches that must never be live in production (CLAUDE.md §2.5, §8). */
const BYPASS_FLAGS = ["VETCREW_TEST_AUTH", "VETCREW_ALLOW_UNREVIEWED_SCORES"] as const;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production") {
    const missing = (["DATABASE_URL", "CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY"] as const).filter(
      (key) => env[key] === undefined,
    );
    if (missing.length > 0) {
      throw new Error(`Missing required production env vars: ${missing.join(", ")}`);
    }
    // Refuse to start rather than start compromised. Only the literal "1"
    // enables a bypass anywhere in the code, so only "1" blocks the boot.
    const enabled = BYPASS_FLAGS.filter((key) => env[key] === "1");
    if (enabled.length > 0) {
      throw new Error(
        `Refusing to boot: production must never enable a bypass. Unset: ${enabled.join(", ")}`,
      );
    }
  }
  return env;
}
