import type { ClientIntent } from "@vetcrew/shared";
import { describe, expect, test } from "vitest";

import type { SessionRoom } from "../live/session-room.js";
import { authorizeIntent, type SocketBinding } from "../live/socket.js";

const room = { injectionMenuIds: () => ["owner_distressed"] } as unknown as SessionRoom;

function binding(stationKind: "instructor" | "trainee"): SocketBinding {
  return {
    sessionId: "s",
    role: stationKind === "instructor" ? "instructor" : "technician",
    actorId: "a",
    tenantId: "t",
    stationKind,
  };
}

describe("authorizeIntent — phase_change to scored", () => {
  // `scored` is server-derived only: the ratings route appends it after the
  // rating set is complete, bypassing this authz path. No client may assert it,
  // in any mode. This is the hole exposed once the time-in-training DB check
  // (which used to block it) is dropped.
  const scoredIntent: ClientIntent = { type: "phase_change", phase: "scored" };

  test("an instructor cannot assert scored", () => {
    const result = authorizeIntent(binding("instructor"), scoredIntent, room);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation");
  });

  test("a trainee cannot assert scored (already role-bound, still refused)", () => {
    const result = authorizeIntent(binding("trainee"), scoredIntent, room);
    expect(result.ok).toBe(false);
  });
});

describe("authorizeIntent — legitimate phase changes still pass", () => {
  test("an instructor may drive briefing/running/paused/debrief/archived", () => {
    for (const phase of ["briefing", "running", "paused", "debrief", "archived"] as const) {
      const result = authorizeIntent(
        binding("instructor"),
        { type: "phase_change", phase },
        room,
      );
      expect(result.ok, `phase ${phase} should be allowed`).toBe(true);
    }
  });

  test("an instructor may inject a menu item and is refused an off-menu one", () => {
    expect(
      authorizeIntent(binding("instructor"), { type: "injection", injection: "owner_distressed" }, room)
        .ok,
    ).toBe(true);
    expect(
      authorizeIntent(binding("instructor"), { type: "injection", injection: "not_on_menu" }, room)
        .ok,
    ).toBe(false);
  });

  test("a trainee is still refused injection and any phase change", () => {
    expect(
      authorizeIntent(binding("trainee"), { type: "injection", injection: "owner_distressed" }, room)
        .ok,
    ).toBe(false);
    expect(
      authorizeIntent(binding("trainee"), { type: "phase_change", phase: "running" }, room).ok,
    ).toBe(false);
  });
});
