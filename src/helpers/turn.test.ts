import { describe, expect, test } from "vitest";

import { turn } from "./turn.js";

describe("turn", () => {
  test("a fresh session has nothing to conflict with", () => {
    expect(turn().conflict()).toBeNull();
  });

  test("the refusal names the call holding the session", () => {
    const door = turn();
    door.begin("promptStream");

    // `busy` rather than a shade of `invalid-state`: the caller's move is to
    // wait or open a second session, and the detail says what to wait for.
    expect(door.conflict()).toEqual({
      kind: "busy",
      detail: "promptStream is already running on this session",
    });
  });

  test("ending releases the door", () => {
    const door = turn();
    door.begin("prompt");
    door.end();

    expect(door.conflict()).toBeNull();
  });

  test("end is idempotent — completion and abort both reach it", () => {
    const door = turn();
    door.begin("prompt");
    door.end();
    door.end();

    expect(door.conflict()).toBeNull();
  });

  test("it is a flag, not a counter", () => {
    // Two begins without an end is a provider bug, but one end must still
    // clear it: the contract has no nested generations, so there is no depth
    // to unwind and no way to leave the door stuck shut.
    const door = turn();
    door.begin("prompt");
    door.begin("promptStream");
    expect(door.conflict()?.kind).toBe("busy");

    door.end();
    expect(door.conflict()).toBeNull();
  });

  test("two sessions do not share a door", () => {
    const first = turn();
    const second = turn();
    first.begin("prompt");

    expect(first.conflict()).not.toBeNull();
    expect(second.conflict()).toBeNull();
  });
});
