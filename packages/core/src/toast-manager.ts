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

interface TimerEntry {
  handle: TimerHandle;
  startedAt: number;
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

/**
 * Validate toast input for runtime safety
 */
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

/**
 * Calculate remaining time for a toast
 */
function getRemainingMs(toast: ToastRecord, currentTime: number): number {
  if (toast.paused && toast.pausedAt !== undefined) {
    const elapsed = toast.pausedAt - toast.createdAt - toast.totalPausedMs;
    return Math.max(0, toast.duration - elapsed);
  }
  const elapsed = currentTime - toast.createdAt - toast.totalPausedMs;
  return Math.max(0, toast.duration - elapsed);
}

/**
 * Pure function to add a toast to state
 */
function addToast(state: InternalState, toast: ToastRecord): InternalState {
  const byId = new Map(state.byId);
  byId.set(toast.id, toast);

  return {
    byId,
    order: [...state.order, toast.id],
  };
}

/**
 * Pure function to remove a toast from state
 */
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

/**
 * Pure function to update a toast in state
 */
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

/**
 * Create state snapshot with active and queued toasts
 */
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

/**
 * Generate a unique ID using crypto.randomUUID if available, fallback to timestamp + random
 */
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

  const timers = new Map<string, TimerEntry>();
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

  /**
   * Stop and remove timer for a toast
   */
  function stopTimer(id: string): void {
    const timer = timers.get(id);
    if (!timer) {
      return;
    }

    clearTimeout(timer.handle);
    timers.delete(id);
  }

  /**
   * Check if a toast is in the active window
   */
  function isActiveToast(id: string): boolean {
    const snapshot = getState();
    return snapshot.active.some((toast) => toast.id === id);
  }

  /**
   * Start timer for a specific toast if eligible
   */
  function startTimerIfNeeded(id: string): void {
    const toast = state.byId.get(id);

    // Don't start timer if:
    // - Toast doesn't exist
    // - Already has timer
    // - Is paused
    // - Is sticky (duration <= 0)
    // - Not in active window
    if (
      !toast ||
      timers.has(id) ||
      toast.paused ||
      toast.duration <= 0 ||
      !isActiveToast(id)
    ) {
      return;
    }

    const remaining = getRemainingMs(toast, now());
    if (remaining <= 0) {
      return;
    }

    const startedAt = now();
    const handle = setTimeout(() => {
      dismiss(id);
    }, remaining);

    timers.set(id, { handle, startedAt });
  }

  /**
   * Promote next queued toast to active and start its timer
   */
  function promoteQueuedToast(): void {
    const snapshot = getState();
    if (snapshot.active.length < maxToasts && snapshot.queued.length > 0) {
      const nextToast = snapshot.queued[0];
      if (nextToast) {
        startTimerIfNeeded(nextToast.id);
      }
    }
  }

  function add(input: ToastInput): string {
    // Validate input
    validateInput(input);

    const id = input.id ?? generateId();
    const existing = state.byId.get(id);

    if (existing) {
      if (dedupe === "ignore") {
        return id;
      }

      // Dedupe: refresh - remove old, add new
      stopTimer(id);
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
    startTimerIfNeeded(id);
    notify();

    return id;
  }

  function dismiss(id: string): void {
    if (!state.byId.has(id)) {
      return;
    }

    stopTimer(id);
    state = removeToast(state, id);
    promoteQueuedToast();
    notify();
  }

  function dismissAll(): void {
    for (const id of Array.from(timers.keys())) {
      stopTimer(id);
    }

    state = {
      order: [],
      byId: new Map(),
    };

    notify();
  }

  function pause(id: string): void {
    const toast = state.byId.get(id);

    // Can only pause active, non-paused, timed toasts
    if (!toast || toast.paused || toast.duration <= 0 || !isActiveToast(id)) {
      return;
    }

    const timer = timers.get(id);
    if (!timer) {
      return;
    }

    // Calculate elapsed time and update pause state
    const elapsed = Math.max(0, now() - timer.startedAt);
    const currentTime = now();

    stopTimer(id);
    state = updateToast(state, id, {
      paused: true,
      pausedAt: currentTime,
      totalPausedMs: toast.totalPausedMs + 0, // Will be updated on resume
    });

    notify();
  }

  function resume(id: string): void {
    const toast = state.byId.get(id);
    if (!toast || !toast.paused || toast.pausedAt === undefined) {
      return;
    }

    // Calculate total paused time
    const pauseDuration = now() - toast.pausedAt;
    const totalPausedMs = toast.totalPausedMs + pauseDuration;

    state = updateToast(state, id, {
      paused: false,
      pausedAt: undefined,
      totalPausedMs,
    });

    startTimerIfNeeded(id);
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
    for (const id of Array.from(timers.keys())) {
      stopTimer(id);
    }

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
