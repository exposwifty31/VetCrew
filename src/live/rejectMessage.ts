import type { SessionReject } from "@vetcrew/shared";

import type { MessageKey } from "../i18n/index.js";

/** Map live session reject codes to user-facing i18n keys. */
export function rejectMessageKey(reject: SessionReject): MessageKey {
  if (reject.code === "auth") {
    if (reject.message.includes("requires authentication")) {
      return "auth.required";
    }
    return "auth.forbidden";
  }
  if (reject.code === "role_bound") {
    return "auth.forbidden";
  }
  switch (reject.code) {
    case "fsm":
      return "live.reject.fsm";
    case "validation":
      return "live.reject.validation";
    case "not_found":
      return "live.reject.notFound";
    case "scenario":
      return "live.reject.scenario";
    case "phase":
      return "live.reject.phase";
    default: {
      const exhaustive: never = reject.code;
      throw new Error(`Unhandled reject code: ${String(exhaustive)}`);
    }
  }
}
