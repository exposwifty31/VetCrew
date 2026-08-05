import { verifyToken } from "@clerk/backend";
import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

import { isBypassEnabled } from "./env.js";

export type VetcrewRole = "manager" | "instructor" | "trainee";

export type AuthSnapshot = {
  readonly isAuthenticated: boolean;
  readonly userId: string | null;
  readonly role: VetcrewRole | null;
};

export type AuthReader = (req: Request) => AuthSnapshot;

const TEST_BEARER_RE = /^test:([^:]+):(manager|instructor|trainee)$/;

/**
 * Defence in depth. `loadEnv` refuses to boot production with this flag set,
 * but `parseTestBearer` is reachable directly from tests and could be reached
 * by a future entry point that never calls `loadEnv` — so the guarantee lives
 * in the module that owns the behaviour, not only at boot.
 */
export function isTestAuthEnabled(): boolean {
  return isBypassEnabled("VETCREW_TEST_AUTH");
}

export function isAuthEnabled(clerkEnabled: boolean): boolean {
  return clerkEnabled || isTestAuthEnabled();
}

export type TokenAuthReader = (token: string | undefined) => Promise<AuthSnapshot>;

/** Normalize socket `auth.token` — accepts raw JWT or `Bearer …` prefix. */
export function authorizationHeaderFromToken(token: string | undefined): string | undefined {
  if (token === undefined || token.length === 0) {
    return undefined;
  }
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
}

export function parseTestBearer(header: string | undefined): AuthSnapshot | null {
  if (!isTestAuthEnabled()) {
    return null;
  }
  if (header === undefined || !header.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length);
  const match = TEST_BEARER_RE.exec(token);
  if (match === null) {
    return null;
  }
  const userId = match[1] ?? null;
  if (userId === null) {
    return null;
  }
  const role = match[2] as VetcrewRole;
  return {
    isAuthenticated: true,
    userId,
    role,
  };
}

function parseVetcrewRole(value: unknown): VetcrewRole | null {
  switch (value) {
    case "manager":
    case "instructor":
    case "trainee":
      return value;
    default:
      return null;
  }
}

function readClerkRole(sessionClaims: Record<string, unknown> | null | undefined): VetcrewRole | null {
  if (sessionClaims === null || sessionClaims === undefined) {
    return null;
  }
  const direct = parseVetcrewRole(sessionClaims["vetcrewRole"]);
  if (direct !== null) {
    return direct;
  }
  const publicMetadata = sessionClaims["publicMetadata"];
  if (typeof publicMetadata === "object" && publicMetadata !== null) {
    return parseVetcrewRole((publicMetadata as Record<string, unknown>)["vetcrewRole"]);
  }
  return null;
}

function readClerkAuth(req: Request): AuthSnapshot {
  const clerkAuth = getAuth(req);
  const userId = clerkAuth.userId ?? null;
  const isAuthenticated = userId !== null;
  const sessionClaims = clerkAuth.sessionClaims as Record<string, unknown> | undefined;
  return {
    isAuthenticated,
    userId,
    role: isAuthenticated ? readClerkRole(sessionClaims) : null,
  };
}

export function readAuth(req: Request): AuthSnapshot {
  const testAuth = parseTestBearer(req.headers.authorization);
  if (testAuth !== null) {
    return testAuth;
  }
  // getAuth requires clerkMiddleware — skip when Clerk keys are absent (test-auth CI).
  if (process.env["CLERK_SECRET_KEY"] === undefined || process.env["CLERK_SECRET_KEY"].length === 0) {
    return { isAuthenticated: false, userId: null, role: null };
  }
  return readClerkAuth(req);
}

/** Socket handshake token → AuthSnapshot (test bearer first, then Clerk JWT). */
export async function readAuthFromToken(
  token: string | undefined,
  clerkSecretKey?: string,
): Promise<AuthSnapshot> {
  const testAuth = parseTestBearer(authorizationHeaderFromToken(token));
  if (testAuth !== null) {
    return testAuth;
  }
  if (clerkSecretKey === undefined) {
    return { isAuthenticated: false, userId: null, role: null };
  }
  const header = authorizationHeaderFromToken(token);
  if (header === undefined) {
    return { isAuthenticated: false, userId: null, role: null };
  }
  const jwt = header.slice("Bearer ".length);
  try {
    const payload = await verifyToken(jwt, { secretKey: clerkSecretKey });
    const userId = payload.sub ?? null;
    if (userId === null) {
      return { isAuthenticated: false, userId: null, role: null };
    }
    const claims = payload as Record<string, unknown>;
    return {
      isAuthenticated: true,
      userId,
      role: readClerkRole(claims),
    };
  } catch {
    return { isAuthenticated: false, userId: null, role: null };
  }
}

export function createReadAuthFromToken(clerkSecretKey: string | undefined): TokenAuthReader {
  return (token: string | undefined) => readAuthFromToken(token, clerkSecretKey);
}

/**
 * When Clerk is enabled, require a signed-in session on the request.
 * Dev-bypass (no keys) leaves routes open for local engine work — loud and
 * temporary (CLAUDE.md / Sprint 5 security veto).
 * `readAuth` is injectable for tests (avoids standing up full Clerk middleware).
 */
export function requireSignedIn(
  clerkEnabled: boolean,
  readAuthFn: AuthReader = readAuth,
) {
  const authEnabled = isAuthEnabled(clerkEnabled);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!authEnabled) {
      next();
      return;
    }
    const auth = readAuthFn(req);
    if (!auth.isAuthenticated) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  };
}

export function requireRole(
  role: VetcrewRole,
  authEnabled: boolean,
  readAuthFn: AuthReader = readAuth,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!authEnabled) {
      next();
      return;
    }
    const auth = readAuthFn(req);
    if (!auth.isAuthenticated) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (auth.role !== role) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}
