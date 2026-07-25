import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import express from "express";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

/**
 * Regression: in production, the SPA catch-all must mount AFTER API routers.
 * Otherwise Express matches `{*splat}` first and returns index.html for GET /api/*.
 */
describe("SPA vs API route order", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.get("/api/health", (_req, res) => {
      res.json({ ok: true });
    });
    // Correct order: API first, SPA last.
    app.get("/api/sessions", (_req, res) => {
      res.json({ sessions: [] });
    });
    app.get("{*splat}", (_req, res) => {
      res.type("html").send("<!doctype html><title>spa</title>");
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

  test("GET /api/sessions returns JSON, not the SPA shell", async () => {
    const res = await fetch(`${baseUrl}/api/sessions`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/json/);
    const body = (await res.json()) as { sessions: unknown[] };
    expect(body.sessions).toEqual([]);
  });

  test("unknown paths still fall through to SPA", async () => {
    const res = await fetch(`${baseUrl}/manager/pitch-trainee`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<!doctype html>");
  });
});
