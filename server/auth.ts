import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export type AuthSnapshot = { readonly isAuthenticated: boolean };
export type AuthReader = (req: Request) => AuthSnapshot;

/**
 * When Clerk is enabled, require a signed-in session on the request.
 * Dev-bypass (no keys) leaves routes open for local engine work — loud and
 * temporary (CLAUDE.md / Sprint 5 security veto).
 * `readAuth` is injectable for tests (avoids standing up full Clerk middleware).
 */
export function requireSignedIn(
  clerkEnabled: boolean,
  readAuth: AuthReader = (req) => getAuth(req),
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!clerkEnabled) {
      next();
      return;
    }
    const auth = readAuth(req);
    if (!auth.isAuthenticated) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  };
}
