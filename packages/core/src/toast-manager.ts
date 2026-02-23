import {
  addToast,
  createStateSnapshot,
  removeToast,
  updateToast,
} from "./helpers/toast-handlers";
import type {
  CreateToastManagerOptions,
  InternalState,
  TimerHandle,
  ToastInput,
  ToastManager,
  ToastRecord,
  ToastState,
  ToastStateListener,
} from "./types";
import { DEFAULT_DEDUPE, DEFAULT_MAX_TOASTS } from "./types";
import { defaultGenerateId, getRemainingMs, validateInput } from "./utils";

/**
 * Creates a toast manager instance for managing toast notifications.
 *
 * @param options - Configuration options
 * @param options.maxToasts - Maximum visible toasts (default: 5, min: 1)
 * @param options.dedupe - How to handle duplicate IDs (default: 'ignore')
 * @param options.now - Time function for testing (default: Date.now)
 * @param options.generateId - ID generator for testing
 *
 * @example
 * ```typescript
 * const manager = createToastManager({ maxToasts: 3 })
 * const id = manager.add({
 *   variant: 'success',
 *   payload: { message: 'Saved!' },
 *   duration: 4000,  // 0 = sticky (never auto-dismiss)
 *   position: 'top-right',
 *   dismissOnClick: true,
 *   role: 'status'
 * })
 * ```
 */
export function createToastManager(
  options: CreateToastManagerOptions = {},
): ToastManager {
  const maxToasts = Math.max(1, options.maxToasts ?? DEFAULT_MAX_TOASTS);
  const dedupe = options.dedupe ?? DEFAULT_DEDUPE;
  const now = options.now ?? Date.now;
  const generateId = options.generateId ?? (() => defaultGenerateId(now));

  let state: InternalState = {
    order: [],
    byId: new Map(),
  };

  const timers = new Map<string, TimerHandle>();
  const listeners = new Set<ToastStateListener>();

  function getState(): ToastState {
    return createStateSnapshot(state, maxToasts);
  }

  function notify(): void {
    const snapshot = getState();
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function stopTimer(id: string): void {
    const handle = timers.get(id);
    if (!handle) {
      return;
    }

    clearTimeout(handle);
    timers.delete(id);
  }

  function clearTimers(): void {
    for (const id of Array.from(timers.keys())) {
      stopTimer(id);
    }
  }

  function getActiveIds(): Set<string> {
    return new Set(state.order.slice(0, maxToasts));
  }

  function isActiveToast(id: string): boolean {
    return state.order.slice(0, maxToasts).includes(id);
  }

  function syncTimers(): void {
    const activeIds = getActiveIds();

    for (const [id, handle] of Array.from(timers.entries())) {
      const toast = state.byId.get(id);
      if (!toast || !activeIds.has(id) || toast.paused || toast.duration <= 0) {
        clearTimeout(handle);
        timers.delete(id);
      }
    }

    const currentTime = now();
    const expiredIds: string[] = [];

    for (const id of activeIds) {
      if (timers.has(id)) {
        continue;
      }

      const toast = state.byId.get(id);
      if (!toast || toast.paused || toast.duration <= 0) {
        continue;
      }

      const remaining = getRemainingMs(toast, currentTime);
      if (remaining <= 0) {
        expiredIds.push(id);
        continue;
      }

      const handle = setTimeout(() => {
        dismiss(id);
      }, remaining);

      timers.set(id, handle);
    }

    if (expiredIds.length > 0) {
      for (const id of expiredIds) {
        state = removeToast(state, id);
      }
      syncTimers();
    }
  }

  function add(input: ToastInput): string {
    validateInput(input);

    const id = input.id ?? generateId();
    const existing = state.byId.get(id);

    if (existing) {
      if (dedupe === "ignore") {
        return id;
      }

      state = removeToast(state, id);
    }

    const duration = Math.max(0, input.duration);

    const toast: ToastRecord = {
      ...input,
      id,
      duration,
      createdAt: now(),
      paused: false,
      totalPausedMs: 0,
    };

    state = addToast(state, toast);
    syncTimers();
    notify();

    return id;
  }

  function dismiss(id: string): void {
    if (!state.byId.has(id)) {
      return;
    }

    state = removeToast(state, id);
    syncTimers();
    notify();
  }

  function dismissAll(): void {
    clearTimers();

    state = {
      order: [],
      byId: new Map(),
    };

    notify();
  }

  function pause(id: string): void {
    const toast = state.byId.get(id);

    if (!toast || toast.paused || toast.duration <= 0 || !isActiveToast(id)) {
      return;
    }

    state = updateToast(state, id, {
      paused: true,
      pausedAt: now(),
    });

    syncTimers();
    notify();
  }

  function resume(id: string): void {
    const toast = state.byId.get(id);
    if (!toast || !toast.paused || toast.pausedAt === undefined) {
      return;
    }

    const pauseDuration = Math.max(0, now() - toast.pausedAt);
    const totalPausedMs = toast.totalPausedMs + pauseDuration;

    state = updateToast(state, id, {
      paused: false,
      pausedAt: undefined,
      totalPausedMs,
    });

    syncTimers();
    notify();
  }

  function subscribe(listener: ToastStateListener): () => void {
    listeners.add(listener);
    listener(getState());

    return () => {
      listeners.delete(listener);
    };
  }

  function destroy(): void {
    clearTimers();

    listeners.clear();

    state = {
      order: [],
      byId: new Map(),
    };
  }

  return {
    add,
    dismiss,
    dismissAll,
    pause,
    resume,
    subscribe,
    getState,
    destroy,
  };
}
