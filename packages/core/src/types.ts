export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type ToastRole = "alert" | "status";

export type DedupeBehavior = "ignore" | "refresh";

/**
 * Default configuration values for toast manager
 */
export const DEFAULT_MAX_TOASTS = 5;
export const DEFAULT_DEDUPE: DedupeBehavior = "ignore";
export const DEFAULT_DURATION = 4000;
export const DEFAULT_POSITION: ToastPosition = "top-right";
export const DEFAULT_DISMISS_ON_CLICK = true;
export const DEFAULT_ROLE: ToastRole = "status";

export interface ToastInput {
  id?: string;
  variant: string;
  payload: Record<string, unknown>;
  /**
   * Duration in milliseconds. Set to 0 for sticky toasts that never auto-dismiss.
   */
  duration: number;
  position: ToastPosition;
  dismissOnClick: boolean;
  role: ToastRole;
}

export interface ToastRecord extends Omit<ToastInput, "id" | "duration"> {
  id: string;
  duration: number;
  createdAt: number;
  paused: boolean;
  pausedAt?: number | undefined;
  totalPausedMs: number;
}

export interface ToastState {
  readonly all: readonly ToastRecord[];
  readonly active: readonly ToastRecord[];
  readonly queued: readonly ToastRecord[];
}

export type TimerHandle = ReturnType<typeof setTimeout>;

export interface InternalState {
  order: string[];
  byId: Map<string, ToastRecord>;
}

export interface CreateToastManagerOptions {
  /**
   * Maximum number of visible toasts (default: 5, minimum: 1)
   */
  maxToasts?: number;
  /**
   * How to handle duplicate toast IDs (default: 'ignore')
   * - 'ignore': Keep existing toast, ignore new one
   * - 'refresh': Remove existing toast, add new one
   */
  dedupe?: DedupeBehavior;
  /**
   * Custom time function for testing (default: Date.now)
   */
  now?: () => number;
  /**
   * Custom ID generator for testing
   */
  generateId?: () => string;
}

export type ToastStateListener = (state: ToastState) => void;

/**
 * Toast manager interface for managing toast notifications
 */
export interface ToastManager {
  /**
   * Add a new toast notification
   * @param input - Toast configuration
   * @returns Toast ID
   */
  add(input: ToastInput): string;
  /**
   * Dismiss a specific toast by ID
   * @param id - Toast ID to dismiss
   */
  dismiss(id: string): void;
  /**
   * Dismiss all active and queued toasts
   */
  dismissAll(): void;
  /**
   * Pause auto-dismiss timer for a toast
   * @param id - Toast ID to pause
   */
  pause(id: string): void;
  /**
   * Resume auto-dismiss timer for a toast
   * @param id - Toast ID to resume
   */
  resume(id: string): void;
  /**
   * Subscribe to toast state changes
   * @param listener - Callback function called on state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: ToastStateListener): () => void;
  /**
   * Get current toast state snapshot
   * @returns Current state
   */
  getState(): ToastState;
  /**
   * Destroy the manager and clean up all resources
   */
  destroy(): void;
}
