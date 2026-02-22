import type {
  CreateToastManagerOptions,
  ToastInput,
  ToastManager,
  ToastPosition,
  ToastRecord,
  ToastRole,
  ToastState,
  ToastStateListener,
} from "./types";
import { DEFAULT_DEDUPE, DEFAULT_MAX_TOASTS } from "./types";

type TimerHandle = ReturnType<typeof setTimeout>;

interface InternalState {
  order: string[];
  byId: Map<string, ToastRecord>;
}

const VALID_POSITIONS: ToastPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const VALID_ROLES: ToastRole[] = ["alert", "status"];

function validateInput(input: ToastInput): void {
  if (input.duration < 0) {
    throw new Error(
      `Invalid duration: ${input.duration}. Duration must be non-negative.`,
    );
  }
  if (!VALID_POSITIONS.includes(input.position)) {
    throw new Error(
      `Invalid position: ${input.position}. Must be one of: ${VALID_POSITIONS.join(", ")}`,
    );
  }
  if (!VALID_ROLES.includes(input.role)) {
    throw new Error(
      `Invalid role: ${input.role}. Must be one of: ${VALID_ROLES.join(", ")}`,
    );
  }
}

function getRemainingMs(toast: ToastRecord, currentTime: number): number {
  if (toast.paused && toast.pausedAt !== undefined) {
    const elapsed = toast.pausedAt - toast.createdAt - toast.totalPausedMs;
    return Math.max(0, toast.duration - elapsed);
  }
  const elapsed = currentTime - toast.createdAt - toast.totalPausedMs;
  return Math.max(0, toast.duration - elapsed);
}

function addToast(state: InternalState, toast: ToastRecord): InternalState {
  const byId = new Map(state.byId);
  byId.set(toast.id, toast);

  return {
    byId,
    order: [...state.order, toast.id],
  };
}

function removeToast(state: InternalState, id: string): InternalState {
  if (!state.byId.has(id)) {
    return state;
  }

  const byId = new Map(state.byId);
  byId.delete(id);

  return {
    byId,
    order: state.order.filter((item) => item !== id),
  };
}

function updateToast(
  state: InternalState,
  id: string,
  patch: Partial<ToastRecord>,
): InternalState {
  const existing = state.byId.get(id);
  if (!existing) {
    return state;
  }

  const byId = new Map(state.byId);
  byId.set(id, { ...existing, ...patch });

  return {
    byId,
    order: state.order,
  };
}

function createStateSnapshot(
  state: InternalState,
  maxToasts: number,
): ToastState {
  const all: ToastRecord[] = [];

  for (const id of state.order) {
    const toast = state.byId.get(id);
    if (toast) {
      all.push(toast);
    }
  }

  return {
    all,
    active: all.slice(0, maxToasts),
    queued: all.slice(maxToasts),
  };
}

function defaultGenerateId(now: () => number): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `toast-${now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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
