import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToastInput } from "../src";
import { createToastManager } from "../src";

function createInput(overrides: Partial<ToastInput> = {}): ToastInput {
  return {
    id: undefined,
    variant: "info",
    payload: { message: "hello" },
    duration: 1000,
    position: "top-right" as const,
    dismissOnClick: true,
    role: "status" as const,
    ...overrides,
  };
}

describe("createToastManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds toast and notifies subscribers", () => {
    const manager = createToastManager({
      generateId: () => "toast-1",
    });
    const listener = vi.fn();

    manager.subscribe(listener);
    manager.add(createInput());

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        all: expect.arrayContaining([
          expect.objectContaining({
            id: "toast-1",
            variant: "info",
          }),
        ]),
      }),
    );
  });

  it("respects queue limit", () => {
    let id = 0;
    const manager = createToastManager({
      maxToasts: 2,
      generateId: () => `toast-${++id}`,
    });

    manager.add(createInput({ duration: 0 }));
    manager.add(createInput({ duration: 0 }));
    manager.add(createInput({ duration: 0 }));

    const state = manager.getState();

    expect(state.active).toHaveLength(2);
    expect(state.queued).toHaveLength(1);
    expect(state.queued[0]?.id).toBe("toast-3");
  });

  it("handles dedupe ignore and refresh", () => {
    const ignoreManager = createToastManager({ dedupe: "ignore" });
    ignoreManager.add(
      createInput({ id: "same", payload: { message: "first" } }),
    );
    ignoreManager.add(
      createInput({ id: "same", payload: { message: "second" } }),
    );

    expect(ignoreManager.getState().all).toHaveLength(1);
    expect(ignoreManager.getState().all[0]?.payload).toEqual({
      message: "first",
    });

    const refreshManager = createToastManager({ dedupe: "refresh" });
    refreshManager.add(
      createInput({ id: "same", payload: { message: "first" } }),
    );
    refreshManager.add(
      createInput({ id: "same", payload: { message: "second" } }),
    );

    expect(refreshManager.getState().all).toHaveLength(1);
    expect(refreshManager.getState().all[0]?.payload).toEqual({
      message: "second",
    });
  });

  it("dismisses one and all toasts", () => {
    const manager = createToastManager({
      generateId: (() => {
        let id = 0;
        return () => `toast-${++id}`;
      })(),
    });

    const first = manager.add(createInput({ duration: 0 }));
    manager.add(createInput({ duration: 0 }));

    manager.dismiss(first);
    expect(manager.getState().all).toHaveLength(1);

    manager.dismissAll();
    expect(manager.getState().all).toHaveLength(0);
  });

  it("pauses and resumes timers correctly", () => {
    let now = 0;
    const manager = createToastManager({
      now: () => now,
      generateId: () => "toast-1",
    });

    manager.add(createInput({ duration: 1000 }));

    // Advance 400ms and pause
    now = 400;
    vi.advanceTimersByTime(400);
    manager.pause("toast-1");

    // Advance 2600ms while paused (should not dismiss)
    now = 3000;
    vi.advanceTimersByTime(2600);
    expect(manager.getState().all).toHaveLength(1);

    // Resume and advance remaining time
    manager.resume("toast-1");
    now = 3600;
    vi.advanceTimersByTime(600);

    expect(manager.getState().all).toHaveLength(0);
  });

  it("validates input and throws on invalid values", () => {
    const manager = createToastManager();

    expect(() => {
      manager.add(createInput({ duration: -1 }));
    }).toThrow("Invalid duration");

    expect(() => {
      manager.add(createInput({ position: "invalid" as any }));
    }).toThrow("Invalid position");

    expect(() => {
      manager.add(createInput({ role: "invalid" as any }));
    }).toThrow("Invalid role");
  });

  it("promotes queued toast when active is dismissed", () => {
    let id = 0;
    const manager = createToastManager({
      maxToasts: 2,
      generateId: () => `toast-${++id}`,
    });

    const id1 = manager.add(createInput({ duration: 0 }));
    manager.add(createInput({ duration: 0 }));
    manager.add(createInput({ duration: 0 }));

    expect(manager.getState().active).toHaveLength(2);
    expect(manager.getState().queued).toHaveLength(1);

    manager.dismiss(id1);

    expect(manager.getState().active).toHaveLength(2);
    expect(manager.getState().queued).toHaveLength(0);
  });

  it("cleans up resources on destroy", () => {
    const manager = createToastManager({
      generateId: () => "toast-1",
    });

    manager.add(createInput({ duration: 10000 }));
    expect(manager.getState().all).toHaveLength(1);

    manager.destroy();
    expect(manager.getState().all).toHaveLength(0);
  });

  it("handles unsubscribe during notification", () => {
    const manager = createToastManager();
    let unsub: (() => void) | null = null;

    unsub = manager.subscribe(() => {
      unsub?.();
    });

    expect(() => {
      manager.add(createInput());
    }).not.toThrow();
  });
});
