import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";

import { hasClerkPublishableKey } from "../hooks/useBearerToken.js";
import { t } from "../i18n/index.js";

const compactBannerStyle = {
  padding: "10px 16px",
  background: "rgba(255, 51, 51, 0.12)",
  borderBottom: "1px solid var(--border-default, #243040)",
  color: "var(--sev-critical, #FF3333)",
  fontWeight: 700,
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 10,
  alignItems: "center",
  justifyContent: "space-between",
};

/** Minimal auth chrome for the pitch shell — Hebrew labels via i18n. */
export default function AuthBar() {
  if (!hasClerkPublishableKey) return null;

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

/** Compact sign-in prompt for instrument surfaces (station / instructor). */
export function CompactAuthBanner() {
  if (!hasClerkPublishableKey) return null;

  return (
    <Show when="signed-out">
      <div role="alert" style={compactBannerStyle}>
        <span>{t("auth.required")}</span>
        <SignInButton mode="modal">
          <button
            type="button"
            style={{
              minHeight: 44,
              paddingInline: 14,
              border: "1px solid var(--border-default, #243040)",
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
      </div>
    </Show>
  );
}
