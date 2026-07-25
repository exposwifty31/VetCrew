import { useAuth } from "@clerk/react";

export const hasClerkPublishableKey =
  typeof import.meta.env.VITE_CLERK_PUBLISHABLE_KEY === "string" &&
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY.length > 0;

/** Clerk-backed bearer. Only call under ClerkProvider (publishable key present). */
export function useClerkBearerToken(): () => Promise<string | null> {
  const { getToken, isSignedIn } = useAuth();
  return async () => {
    if (!isSignedIn) return null;
    return (await getToken()) ?? null;
  };
}

export async function noBearerToken(): Promise<string | null> {
  return null;
}
