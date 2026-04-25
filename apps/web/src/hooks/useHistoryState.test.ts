import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHistoryState } from "./useHistoryState";

describe("useHistoryState", () => {
  const originalState = window.history.state;

  beforeEach(() => {
    // Reset history state before each test.
    window.history.replaceState(null, "");
  });

  afterEach(() => {
    window.history.replaceState(originalState, "");
  });

  it("returns the initial value when no history state exists", () => {
    const { result } = renderHook(() => useHistoryState("test", "hello"));
    expect(result.current[0]).toBe("hello");
  });

  it("reads existing value from history.state on mount", () => {
    window.history.replaceState({ myKey: "stored" }, "");
    const { result } = renderHook(() => useHistoryState("myKey", "default"));
    expect(result.current[0]).toBe("stored");
  });

  it("pushes a new history entry when state changes", () => {
    const { result } = renderHook(() => useHistoryState("nav", "page1"));
    const lengthBefore = window.history.length;

    act(() => {
      result.current[1]("page2");
    });

    expect(result.current[0]).toBe("page2");
    expect(window.history.state?.nav).toBe("page2");
    // History length should have increased by 1.
    expect(window.history.length).toBe(lengthBefore + 1);
  });

  it("does not push a history entry on initial mount", () => {
    const lengthBefore = window.history.length;
    renderHook(() => useHistoryState("init", "start"));
    // replaceState on mount does not increase history.length.
    expect(window.history.length).toBe(lengthBefore);
  });

  it("restores state on popstate (Back)", async () => {
    const { result } = renderHook(() => useHistoryState("step", "a"));

    act(() => {
      result.current[1]("b");
    });
    expect(result.current[0]).toBe("b");

    act(() => {
      result.current[1]("c");
    });
    expect(result.current[0]).toBe("c");

    // Simulate pressing Back — go back and fire popstate.
    await act(async () => {
      window.history.back();
      // jsdom dispatches popstate synchronously via back(), but we
      // need to flush microtasks.
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current[0]).toBe("b");
  });

  it("does not create duplicate history entries on popstate restore", async () => {
    const { result } = renderHook(() => useHistoryState("dup", "x"));

    act(() => {
      result.current[1]("y");
    });

    const lengthAfterPush = window.history.length;

    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 50));
    });

    // Going back should not push another entry.
    expect(window.history.length).toBe(lengthAfterPush);
    expect(result.current[0]).toBe("x");
  });

  it("supports multiple hooks with different keys", () => {
    const { result: resultA } = renderHook(() =>
      useHistoryState("keyA", "a1"),
    );
    renderHook(() => useHistoryState("keyB", "b1"));

    act(() => {
      resultA.current[1]("a2");
    });

    // keyB should remain unaffected.
    expect(resultA.current[0]).toBe("a2");
    expect(window.history.state?.keyA).toBe("a2");
    // keyB's initial value should still be in history state from its mount.
    expect(window.history.state?.keyB).toBe("b1");
  });

  it("works with object values", () => {
    const { result } = renderHook(() =>
      useHistoryState<{ page: string } | null>("obj", null),
    );

    act(() => {
      result.current[1]({ page: "details" });
    });

    expect(result.current[0]).toEqual({ page: "details" });
    expect(window.history.state?.obj).toEqual({ page: "details" });
  });

  it("restores initial value when popstate has no entry for the key", async () => {
    // Seed a history entry without our key.
    window.history.pushState({ other: "data" }, "");

    const { result } = renderHook(() => useHistoryState("missing", "fallback"));

    act(() => {
      result.current[1]("changed");
    });

    // Go back to the entry that doesn't have our key.
    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current[0]).toBe("fallback");
  });
});

describe("useHistoryState – multi-step flow (map → register → waitlist)", () => {
  beforeEach(() => {
    window.history.replaceState(null, "");
  });

  it("supports a full Back/Forward cycle through a multi-step flow", async () => {
    const { result } = renderHook(() =>
      useHistoryState<"map" | "register" | "waitlist">("pageView", "map"),
    );

    // Step 1: map -> register
    act(() => {
      result.current[1]("register");
    });
    expect(result.current[0]).toBe("register");

    // Step 2: register -> waitlist
    act(() => {
      result.current[1]("waitlist");
    });
    expect(result.current[0]).toBe("waitlist");

    // Back: waitlist -> register
    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current[0]).toBe("register");

    // Back: register -> map
    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current[0]).toBe("map");

    // Forward: map -> register
    await act(async () => {
      window.history.forward();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current[0]).toBe("register");

    // Forward: register -> waitlist
    await act(async () => {
      window.history.forward();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current[0]).toBe("waitlist");
  });
});
