import type { SessionPhase } from "@vetcrew/engine";
import type { ClientIntent } from "@vetcrew/shared";
import { describe, expect, test } from "vitest";

import type { SessionRoom } from "../live/session-room.js";
import { authorizeIntent, type SocketBinding } from "../live/socket.js";

function makeRoom(
  mode: "assessment" | "practice" | "tutorial" = "practice",
  phase: SessionPhase = "running",
): SessionRoom {
  return {
    injectionMenuIds: () => ["owner_distressed"],
    mode,
    phase,
  } as unknown as SessionRoom;
}

const room = makeRoom();

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

describe("assessment mode is enforced at the transport layer", () => {
  // The whole difference between the two platforms has to be a capability the
  // system withholds, not a rule the examiner is trusted to follow (§1.1) —
  // and it binds the INSTRUCTOR, who in assessment is the examiner.
  test("the examiner cannot inject during an assessment", () => {
    const result = authorizeIntent(
      binding("instructor"),
      { type: "injection", injection: "owner_distressed" },
      makeRoom("assessment"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("pre-set");
  });

  test("the examiner cannot pause an assessment", () => {
    const result = authorizeIntent(
      binding("instructor"),
      { type: "phase_change", phase: "paused" },
      makeRoom("assessment"),
    );
    expect(result.ok).toBe(false);
  });

  test("the examiner cannot bury a bad assessment run by archiving it from debrief", () => {
    const result = authorizeIntent(
      binding("instructor"),
      { type: "phase_change", phase: "archived" },
      makeRoom("assessment", "debrief"),
    );
    expect(result.ok).toBe(false);
  });

  test("the same instructor may do all of that in practice mode", () => {
    expect(
      authorizeIntent(
        binding("instructor"),
        { type: "injection", injection: "owner_distressed" },
        makeRoom("practice"),
      ).ok,
    ).toBe(true);
    expect(
      authorizeIntent(
        binding("instructor"),
        { type: "phase_change", phase: "paused" },
        makeRoom("practice"),
      ).ok,
    ).toBe(true);
    expect(
      authorizeIntent(
        binding("instructor"),
        { type: "phase_change", phase: "archived" },
        makeRoom("practice", "debrief"),
      ).ok,
    ).toBe(true);
  });
});
