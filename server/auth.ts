import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export type VetcrewRole = "manager" | "instructor" | "trainee";

export type AuthSnapshot = {
  readonly isAuthenticated: boolean;
  readonly userId: string | null;
  readonly role: VetcrewRole | null;
};

export type AuthReader = (req: Request) => AuthSnapshot;

const TEST_BEARER_RE = /^test:([^:]+):(manager|instructor|trainee)$/;

export function isTestAuthEnabled(): boolean {
  return process.env.VETCREW_TEST_AUTH === "1";
}

export function isAuthEnabled(clerkEnabled: boolean): boolean {
  return clerkEnabled || isTestAuthEnabled();
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
  return readClerkAuth(req);
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
