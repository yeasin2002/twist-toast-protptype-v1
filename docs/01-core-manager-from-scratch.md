# Core Manager From Scratch (`@twist-toast/core`)

## 1. Goal

Build a framework-agnostic toast behavior engine.

What the core owns:

- toast creation and state transitions
- queueing (`maxToasts`)
- timers and auto-dismiss
- pause/resume logic
- dedupe behavior
- subscription updates

What the core does not own:

- rendering
- CSS or animations
- React-specific concerns

This separation keeps core reusable for React now and other adapters later.

## 2. Public API Contracts

Defined in `packages/core/src/types.ts`:

- `createToastManager(options?)`
- methods: `add`, `dismiss`, `dismissAll`, `pause`, `resume`, `subscribe`, `getState`, `destroy`
- types: `ToastInput`, `ToastRecord`, `ToastState`, `ToastPosition`, `ToastRole`, `DedupeBehavior`

Why this matters:

- API is small and explicit
- state shape is stable for adapters
- no UI assumptions leak into core

## 3. Internal State Model

Implemented in `packages/core/src/toast-manager.ts`.

State structure:

- `order: string[]` keeps insertion order
- `byId: Map<string, ToastRecord>` stores toast data
- `timers: Map<string, { handle; startedAt }>` tracks active countdowns

Why this model:

- `Map` gives fast id-based operations
- `order` preserves queue order without sorting
- timers are separate from toast records, so timer lifecycle can be reset safely

## 4. Pure Update Helpers

Helper functions:

- `addToast(state, toast)`
- `removeToast(state, id)`
- `updateToast(state, id, patch)`
- `toOrderedToasts(state)`
- `createStateSnapshot(state, maxToasts)`

Why this structure:

- mutations stay predictable
- each method focuses on one concern
- easier to test and reason about edge cases

## 5. Snapshot Rules (Active vs Queued)

`createStateSnapshot` derives:

- `all`: ordered toasts
- `active`: first `maxToasts`
- `queued`: remaining toasts

Important behavior:

- queued toasts exist in state but should not count down
- only active toasts can have running timers

## 6. Timer Orchestration (`syncTimers`)

`syncTimers()` is the central control point and is called after each mutation.

It does two passes:

1. Stop timers that should no longer run:
   - toast removed
   - toast moved out of active window
   - toast paused
   - toast is sticky (`duration <= 0`)
   - no time left (`remainingMs <= 0`)
2. Start timers for active toasts that are eligible:
   - active
   - not paused
   - duration > 0
   - remaining time > 0
   - no timer already running

Why this matters:

- avoids timer drift between queue and active list
- keeps logic centralized instead of duplicated across methods

## 7. Add + Dedupe Behavior

`add(input)` flow:

1. Resolve `id` (`input.id` or generated id)
2. If toast with same id exists:
   - `dedupe: "ignore"` -> return existing id, no changes
   - `dedupe: "refresh"` -> remove old, add new
3. Clamp `duration` to non-negative
4. Create `ToastRecord` with `createdAt`, `remainingMs`, `paused`
5. Add toast, sync timers, notify subscribers

Why `dedupe` is id-based:

- deterministic behavior for repeated operations
- consumers can intentionally target specific toasts

## 8. Dismiss + Pause/Resume

`dismiss(id)`:

- clear timer
- remove toast
- sync timers to activate next queued toast
- notify

`dismissAll()`:

- clear all timers
- reset state
- notify

`pause(id)`:

- only valid for active timed toasts
- compute elapsed time from `startedAt`
- update `remainingMs`
- mark paused, clear timer, sync, notify

`resume(id)`:

- mark unpaused
- sync timers (which restarts countdown with `remainingMs`)
- notify

Why elapsed-time math exists:

- prevents countdown reset after hover pause
- gives accurate behavior under repeated pause/resume

## 9. Subscription + Lifecycle

`subscribe(listener)`:

- listener is called immediately with current snapshot
- returns unsubscribe function

`destroy()`:

- clears timers
- clears listeners
- resets internal state

Why immediate subscribe callback:

- adapters can render current state without waiting for next mutation

## 10. Test Coverage

Core tests in `packages/core/tests/toast-manager.test.ts` protect:

- subscriber notifications on add
- queue limit behavior
- dedupe (`ignore` vs `refresh`)
- dismiss and dismissAll
- pause/resume timer correctness with fake timers

These tests target behavior contracts, not internal implementation details.

## 11. Key Design Decisions and Tradeoffs

What was prioritized:

- functional closure architecture over class manager
- deterministic snapshots
- adapter-friendly API
- testability with injected `now` and `generateId`

Tradeoffs accepted for v1:

- no priority levels in queue
- no persistence layer
- no built-in transitions (handled by adapter/UI layer)

## 12. Rebuild Checklist

If you rebuild from zero:

1. Define strict types first.
2. Implement immutable helper functions.
3. Implement state snapshot (`all`, `active`, `queued`).
4. Implement `syncTimers` before public mutations.
5. Add `add`, `dismiss`, `dismissAll`, `pause`, `resume`.
6. Add `subscribe` and `destroy`.
7. Add fake-timer tests for all timing behavior.
8. Keep core free from React and CSS.
