import { useAuth } from "@clerk/react";

import { readE2ETestToken } from "../e2e-token.js";

export const hasClerkPublishableKey =
  typeof import.meta.env.VITE_CLERK_PUBLISHABLE_KEY === "string" &&
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY.length > 0;

async function resolveBearerToken(
  clerkGetToken?: () => Promise<string | null>,
): Promise<string | null> {
  const e2e = readE2ETestToken();
  if (e2e !== null) return e2e;
  if (clerkGetToken !== undefined) return clerkGetToken();
  return null;
}

/** Clerk-backed bearer. Only call under ClerkProvider (publishable key present). */
export function useClerkBearerToken(): () => Promise<string | null> {
  const { getToken, isSignedIn } = useAuth();
  const clerkGetToken = async () => {
    if (!isSignedIn) return null;
    return (await getToken()) ?? null;
  };
  return async () => resolveBearerToken(clerkGetToken);
}

/** E2E test token when injected; otherwise null (dev-bypass / no Clerk). */
export async function e2eOrNoBearerToken(): Promise<string | null> {
  return resolveBearerToken();
}

/** @deprecated Use e2eOrNoBearerToken — kept as alias for call sites migrating. */
export async function noBearerToken(): Promise<string | null> {
  return e2eOrNoBearerToken();
}
