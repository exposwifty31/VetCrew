import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import express, { type Request } from "express";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { requireSignedIn } from "../auth.js";

describe("requireSignedIn", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.get(
      "/api/trainees/:id/evidence",
      requireSignedIn(true, () => ({ isAuthenticated: false })),
      (_req, res) => {
        res.json({ leak: true });
      },
    );
    app.get(
      "/api/open",
      requireSignedIn(false, () => ({ isAuthenticated: false })),
      (_req, res) => {
        res.json({ open: true });
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

  test("returns 401 when Clerk is enabled and the request is unsigned", async () => {
    const res = await fetch(`${baseUrl}/api/trainees/x/evidence`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unauthorized");
  });

  test("passes through when Clerk is disabled (dev-bypass)", async () => {
    const res = await fetch(`${baseUrl}/api/open`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ open: true });
  });

  test("unused Request param keeps AuthReader signature stable", () => {
    const reader = (_req: Request) => ({ isAuthenticated: true as const });
    expect(reader({} as Request).isAuthenticated).toBe(true);
  });
});

describe("session REST auth gate", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    // Mimic production mount: auth middleware wraps the session surface.
    app.use("/api/sessions", requireSignedIn(true, () => ({ isAuthenticated: false })));
    app.get("/api/sessions", (_req, res) => {
      res.json({ sessions: [{ id: "should-not-leak" }] });
    });
    app.post("/api/sessions", (_req, res) => {
      res.status(201).json({ session: { id: "should-not-create" } });
    });
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

  test("GET /api/sessions returns 401 when Clerk is enabled and unsigned", async () => {
    const res = await fetch(`${baseUrl}/api/sessions`);
    expect(res.status).toBe(401);
  });

  test("POST /api/sessions returns 401 when Clerk is enabled and unsigned", async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarioSlug: "base-rung-resp-distress" }),
    });
    expect(res.status).toBe(401);
  });
});
