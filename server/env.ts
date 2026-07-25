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
});

export type Env = z.infer<typeof envSchema>;

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
  }
  return env;
}
