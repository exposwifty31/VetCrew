import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import express from "express";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import {
  isAuthEnabled,
  parseTestBearer,
  readAuth,
  requireRole,
  requireSignedIn,
  type AuthSnapshot,
  type VetcrewRole,
} from "../auth.js";

const ORIGINAL_TEST_AUTH = process.env.VETCREW_TEST_AUTH;

afterEach(() => {
  if (ORIGINAL_TEST_AUTH === undefined) {
    delete process.env.VETCREW_TEST_AUTH;
  } else {
    process.env.VETCREW_TEST_AUTH = ORIGINAL_TEST_AUTH;
  }
});

describe("parseTestBearer", () => {
  test("returns null when VETCREW_TEST_AUTH is not enabled", () => {
    delete process.env.VETCREW_TEST_AUTH;
    expect(parseTestBearer("Bearer test:user-1:manager")).toBeNull();
  });

  test("parses userId and role when VETCREW_TEST_AUTH=1", () => {
    process.env.VETCREW_TEST_AUTH = "1";
    expect(parseTestBearer("Bearer test:user-1:manager")).toEqual({
      isAuthenticated: true,
      userId: "user-1",
      role: "manager",
    } satisfies AuthSnapshot);
  });

  test("accepts instructor and trainee roles", () => {
    process.env.VETCREW_TEST_AUTH = "1";
    expect(parseTestBearer("Bearer test:inst-9:instructor")?.role).toBe("instructor");
    expect(parseTestBearer("Bearer test:tr-2:trainee")?.role).toBe("trainee");
  });

  test("returns null for malformed bearer tokens", () => {
    process.env.VETCREW_TEST_AUTH = "1";
    expect(parseTestBearer(undefined)).toBeNull();
    expect(parseTestBearer("Bearer clerk-jwt")).toBeNull();
    expect(parseTestBearer("Bearer test:user-only")).toBeNull();
    expect(parseTestBearer("Bearer test:user:admin")).toBeNull();
  });
});

describe("readAuth", () => {
  test("prefers test bearer when VETCREW_TEST_AUTH=1", () => {
    process.env.VETCREW_TEST_AUTH = "1";
    const req = {
      headers: { authorization: "Bearer test:ci-user:trainee" },
    } as express.Request;

    expect(readAuth(req)).toEqual({
      isAuthenticated: true,
      userId: "ci-user",
      role: "trainee",
    });
  });

  test("maps Clerk session to AuthSnapshot with role from sessionClaims", async () => {
    delete process.env.VETCREW_TEST_AUTH;
    vi.resetModules();
    const getAuth = vi.fn(() => ({
      userId: "clerk-user",
      sessionClaims: { vetcrewRole: "manager" as VetcrewRole },
    }));
    vi.doMock("@clerk/express", () => ({ getAuth }));

    const { readAuth: readAuthFresh } = await import("../auth.js");
    const req = { headers: {} } as express.Request;

    expect(readAuthFresh(req)).toEqual({
      isAuthenticated: true,
      userId: "clerk-user",
      role: "manager",
    });

    vi.doUnmock("@clerk/express");
    vi.resetModules();
  });

  test("authenticated Clerk user without role yields role=null", async () => {
    delete process.env.VETCREW_TEST_AUTH;
    vi.resetModules();
    const getAuth = vi.fn(() => ({
      userId: "clerk-user",
      sessionClaims: {},
    }));
    vi.doMock("@clerk/express", () => ({ getAuth }));

    const { readAuth: readAuthFresh } = await import("../auth.js");
    const req = { headers: {} } as express.Request;

    expect(readAuthFresh(req)).toEqual({
      isAuthenticated: true,
      userId: "clerk-user",
      role: null,
    });

    vi.doUnmock("@clerk/express");
    vi.resetModules();
  });
});

describe("isAuthEnabled", () => {
  test("is true when Clerk is on or test auth is on", () => {
    delete process.env.VETCREW_TEST_AUTH;
    expect(isAuthEnabled(true)).toBe(true);
    expect(isAuthEnabled(false)).toBe(false);

    process.env.VETCREW_TEST_AUTH = "1";
    expect(isAuthEnabled(false)).toBe(true);
  });
});

describe("requireSignedIn with test auth", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.VETCREW_TEST_AUTH = "1";
    const app = express();
    app.get(
      "/api/protected",
      requireSignedIn(false, () => ({ isAuthenticated: false, userId: null, role: null })),
      (_req, res) => {
        res.json({ ok: true });
      },
    );
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, (err?: Error) => (err ? reject(err) : resolve()));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  test("returns 401 when test auth is on and request is unsigned", async () => {
    const res = await fetch(`${baseUrl}/api/protected`);
    expect(res.status).toBe(401);
  });
});

describe("requireRole", () => {
  test("returns 401 when unsigned", async () => {
    const app = express();
    let serverLocal: Server;
    app.get(
      "/api/manager-only",
      requireRole("manager", true, () => ({
        isAuthenticated: false,
        userId: null,
        role: null,
      })),
      (_req, res) => {
        res.json({ manager: true });
      },
    );
    await new Promise<void>((resolve, reject) => {
      serverLocal = app.listen(0, (err?: Error) => (err ? reject(err) : resolve()));
    });
    const url = `http://127.0.0.1:${(serverLocal!.address() as AddressInfo).port}`;
    const res = await fetch(`${url}/api/manager-only`);
    expect(res.status).toBe(401);
    await new Promise<void>((resolve, reject) => {
      serverLocal!.close((err) => (err ? reject(err) : resolve()));
    });
  });

  test("returns 403 when authenticated trainee hits manager route", async () => {
    process.env.VETCREW_TEST_AUTH = "1";
    const app = express();
    let serverLocal: Server;
    app.get(
      "/api/manager-only",
      requireRole("manager", true, (req) => readAuth(req)),
      (_req, res) => {
        res.json({ manager: true });
      },
    );
    await new Promise<void>((resolve, reject) => {
      serverLocal = app.listen(0, (err?: Error) => (err ? reject(err) : resolve()));
    });
    const url = `http://127.0.0.1:${(serverLocal!.address() as AddressInfo).port}`;
    const res = await fetch(`${url}/api/manager-only`, {
      headers: { authorization: "Bearer test:trainee-1:trainee" },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("forbidden");
    await new Promise<void>((resolve, reject) => {
      serverLocal!.close((err) => (err ? reject(err) : resolve()));
    });
  });

  test("passes when role matches", async () => {
    process.env.VETCREW_TEST_AUTH = "1";
    const app = express();
    let serverLocal: Server;
    app.get(
      "/api/manager-only",
      requireRole("manager", true, (req) => readAuth(req)),
      (_req, res) => {
        res.json({ manager: true });
      },
    );
    await new Promise<void>((resolve, reject) => {
      serverLocal = app.listen(0, (err?: Error) => (err ? reject(err) : resolve()));
    });
    const url = `http://127.0.0.1:${(serverLocal!.address() as AddressInfo).port}`;
    const res = await fetch(`${url}/api/manager-only`, {
      headers: { authorization: "Bearer test:mgr-1:manager" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ manager: true });
    await new Promise<void>((resolve, reject) => {
      serverLocal!.close((err) => (err ? reject(err) : resolve()));
    });
  });

  test("passes through when auth is disabled", async () => {
    const app = express();
    let serverLocal: Server;
    app.get(
      "/api/open-manager",
      requireRole("manager", false, () => ({
        isAuthenticated: false,
        userId: null,
        role: null,
      })),
      (_req, res) => {
        res.json({ open: true });
      },
    );
    await new Promise<void>((resolve, reject) => {
      serverLocal = app.listen(0, (err?: Error) => (err ? reject(err) : resolve()));
    });
    const url = `http://127.0.0.1:${(serverLocal!.address() as AddressInfo).port}`;
    const res = await fetch(`${url}/api/open-manager`);
    expect(res.status).toBe(200);
    await new Promise<void>((resolve, reject) => {
      serverLocal!.close((err) => (err ? reject(err) : resolve()));
    });
  });
});
