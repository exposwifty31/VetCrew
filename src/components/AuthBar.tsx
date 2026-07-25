import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";

import { t } from "../i18n/index.js";

const hasClerkKey =
  typeof import.meta.env.VITE_CLERK_PUBLISHABLE_KEY === "string" &&
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY.length > 0;

/** Minimal auth chrome for the pitch shell — Hebrew labels via i18n. */
export default function AuthBar() {
  if (!hasClerkKey) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        justifyContent: "flex-end",
        marginBlockEnd: 16,
        minHeight: 44,
      }}
    >
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            style={{
              minHeight: 44,
              paddingInline: 14,
              border: "1px solid var(--border-default, #2a3a42)",
              borderRadius: 8,
              background: "transparent",
              color: "inherit",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t("auth.signIn")}
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button
            type="button"
            style={{
              minHeight: 44,
              paddingInline: 14,
              border: 0,
              borderRadius: 8,
              background: "var(--action-accent, #008080)",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t("auth.signUp")}
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}
