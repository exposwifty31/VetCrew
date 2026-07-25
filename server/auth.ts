import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

/**
 * When Clerk is enabled, require a signed-in session on the request.
 * Dev-bypass (no keys) leaves routes open for local engine work — loud and
 * temporary (CLAUDE.md / Sprint 5 security veto).
 */
export function requireSignedIn(clerkEnabled: boolean) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!clerkEnabled) {
      next();
      return;
    }
    const auth = getAuth(req);
    if (!auth.isAuthenticated) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  };
}
