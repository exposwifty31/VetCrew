import { describe, expect, test } from "vitest";

import { loadEnv } from "../env.js";

const PRODUCTION_BASE = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://user:pass@localhost:5432/vetcrew",
  CLERK_SECRET_KEY: "sk_test_x",
  CLERK_PUBLISHABLE_KEY: "pk_test_x",
} satisfies NodeJS.ProcessEnv;

describe("loadEnv production bypass gate", () => {
  test("boots in production when no bypass flag is set", () => {
    expect(() => loadEnv({ ...PRODUCTION_BASE })).not.toThrow();
  });

  test("refuses to boot in production with VETCREW_TEST_AUTH=1", () => {
    expect(() => loadEnv({ ...PRODUCTION_BASE, VETCREW_TEST_AUTH: "1" })).toThrow(
      /VETCREW_TEST_AUTH/,
    );
  });

  test("refuses to boot in production with VETCREW_ALLOW_UNREVIEWED_SCORES=1", () => {
    expect(() =>
      loadEnv({ ...PRODUCTION_BASE, VETCREW_ALLOW_UNREVIEWED_SCORES: "1" }),
    ).toThrow(/VETCREW_ALLOW_UNREVIEWED_SCORES/);
  });

  test("names both flags when both are set", () => {
    expect(() =>
      loadEnv({
        ...PRODUCTION_BASE,
        VETCREW_TEST_AUTH: "1",
        VETCREW_ALLOW_UNREVIEWED_SCORES: "1",
      }),
    ).toThrow(/VETCREW_TEST_AUTH, VETCREW_ALLOW_UNREVIEWED_SCORES/);
  });

  test("a value other than \"1\" is not treated as enabled", () => {
    // Only the literal "1" enables a flag anywhere in the code, so only "1"
    // should block a production boot.
    expect(() =>
      loadEnv({ ...PRODUCTION_BASE, VETCREW_TEST_AUTH: "0" }),
    ).not.toThrow();
    expect(() =>
      loadEnv({ ...PRODUCTION_BASE, VETCREW_TEST_AUTH: "false" }),
    ).not.toThrow();
  });

  test("allows the flags outside production — this is what keeps CI working", () => {
    expect(() =>
      loadEnv({ NODE_ENV: "development", VETCREW_TEST_AUTH: "1" }),
    ).not.toThrow();
    expect(() =>
      loadEnv({ NODE_ENV: "test", VETCREW_ALLOW_UNREVIEWED_SCORES: "1" }),
    ).not.toThrow();
  });

  test("still requires the production secrets", () => {
    expect(() => loadEnv({ NODE_ENV: "production" })).toThrow(/Missing required production/);
  });
});
