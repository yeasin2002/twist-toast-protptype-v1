# How To Build a Toast Library (Logic-First Guide)

This guide explains how to build a toast library from scratch, focusing on the **core logic**, not React basics.

If you already know React and JavaScript, read this like an engineering playbook: what to build first, why each piece exists, and how the pieces interact.

## 1. Core Principle

A good toast library should separate two concerns:

- `Behavior engine` (state machine): queue, timers, dedupe, dismiss, lifecycle.
- `UI adapter` (renderer): React provider + component mapping + portal rendering.

A useful mantra is:

> "Own behavior centrally, render flexibly."

This is the single most important design choice. If you couple behavior and UI too early, the system becomes hard to extend (new framework adapters, custom visuals, scoped instances).

## 2. Mental Model

Think in layers:

1. `Core manager` (framework-agnostic)
2. `Typed factory` (`createToast`) that turns variant map into a typed API
3. `Provider` that subscribes and renders

Another way to say it:

> "The manager decides what should happen. The provider decides how it appears."

## 3. Data Model You Actually Need

Every toast is a record with behavior metadata. Minimum shape:

- `id`: stable key for dedupe/dismiss
- `variant`: e.g. success/error/custom
- `payload`: user data forwarded to UI
- `duration`: auto-dismiss ms
- `position`: top-right, etc.
- `dismissOnClick`: behavior flag
- `role`: accessibility role (`status`/`alert`)
- `createdAt`: ordering/tie-break
- `scope`: for multi-provider isolation

Why this matters:

- Without `id`, dedupe and targeted dismiss are weak.
- Without `createdAt`, ordering can drift during refreshes.
- Without `scope`, global and modal instances can leak into each other.

## 4. Manager Contract (Public Behavior API)

A manager should expose only behavior methods:

- `trigger(variant, payload, options?) -> id`
- `dismiss(id)`
- `dismissAll()`
- `pauseByPosition(position)`
- `resumeByPosition(position)`
- `getSnapshot()`
- `subscribe(listener)`

This is enough to support most toast UX needs while staying small.

## 5. Internal State Shape

Keep state explicit and simple:

- `visible: ToastRecord[]`
- `queued: ToastRecord[]`
- `timers: Map<toastId, TimerState>`
- `listeners: Set<subscriber>`
- `pausedPositions: Set<ToastPosition>`

Where `TimerState` is:

- `timeoutId`
- `startedAt`
- `remainingMs`
- `paused`
- `position`

This allows precise pause/resume behavior instead of naive clear/restart.

## 6. Trigger Flow (The Heart)

When `trigger()` is called:

1. Normalize options with defaults.
2. Build `nextToast` record.
3. Check dedupe by `id` in `visible` + `queued`.
4. If duplicate:

- `ignore`: return existing id
- `refresh`: replace existing record and restart timer if visible

5. If not duplicate:

- if `visible.length < maxToasts`: push to visible + start timer
- else: push to queued

6. Emit new snapshot.

Important design quote:

> "Queue is backpressure for notifications."

Without queueing, bursts overwhelm users and destroy signal-to-noise.

## 7. Queue Promotion Logic

On any visible dismissal:

- remove dismissed toast from `visible`
- promote from `queued` while there is capacity
- start timers for promoted items
- emit snapshot

This ensures deterministic flow and avoids starvation.

## 8. Timer Logic (Where Many Libraries Get Bugs)

### Start timer

- If `duration <= 0`, skip auto-dismiss.
- If position is paused, register timer state as paused with remaining duration.
- Else create timeout and track start time.

### Pause

For each visible toast in that position:

- clear active timeout
- compute elapsed = `now - startedAt`
- `remainingMs = max(0, remainingMs - elapsed)`
- mark paused

### Resume

For each paused toast in that position:

- if `remainingMs <= 0`: dismiss immediately
- else start new timeout for `remainingMs`

### Why position-based pause?

Because hover is usually on a viewport region, not a single toast.

## 9. Dedupe Strategy

Two valid modes:

- `ignore`: duplicate id does nothing
- `refresh`: duplicate id updates payload/options and resets visibility timer

`refresh` is useful for progress/status updates:

> "Same job, new state" should update one toast, not create many.

## 10. Scope Isolation (Global vs Modal)

You need one more abstraction outside manager: a registry.

Registry responsibilities:

- register toast instances by `scope`
- track mounted providers by `scope`
- notify providers when scope registrations change
- warn once if a toast is triggered but no provider is mounted for that scope

This prevents cross-scope rendering leaks.

## 11. Typed Factory (`createToast`) Design

Goal: infer methods from component map.

Input:

```ts
createToast({ success: SuccessToast, error: ErrorToast }, options);
```

Output:

- `toast.success(payload, options?)`
- `toast.error(payload, options?)`
- `toast.show(variant, payload, options?)`
- `toast.dismiss(id)`
- `toast.dismissAll()`

Type trick:

- take each component props
- remove internal props (`toastId`, `dismiss`)
- use remaining props as payload type for that variant

This gives strong DX without manual generic arguments.

## 12. Provider Responsibilities (React Adapter)

Provider should do exactly this:

1. Mount a portal host in `document.body`
2. Subscribe to managers in matching `scope`
3. Collect and group visible toasts by `position`
4. Render user component for each toast, injecting:

- `toastId`
- `dismiss()` callback
- user payload

5. Wire hover pause/resume by position
6. Add accessibility attributes (`aria-live`, role)

Do not put business logic here. Keep manager as source of truth.

## 13. Accessibility Rules That Matter

- Use `role="status"` for non-urgent, `role="alert"` for urgent.
- Map to live regions (`polite` vs `assertive`).
- Do not steal focus when toasts appear.
- Keep dismiss controls keyboard-accessible.

In practice:

- wrapper can be keyboard-focusable for Escape dismiss.
- user-provided component can include explicit dismiss button.

## 14. Why This Architecture Scales

Because it is intentionally boring and modular:

- `core` can be reused in Vue/Svelte later.
- `react` adapter stays thin.
- UI remains fully user-owned.
- behavior changes happen in one manager.

This is exactly what you want for OSS maintainability.

## 15. Step-by-Step Build Order (From Scratch)

Use this order if rebuilding from zero:

1. Define shared types (`ToastRecord`, options, manager interface).
2. Implement manager state (`visible`, `queued`, listeners).
3. Implement `trigger` + queue promotion.
4. Add timer lifecycle.
5. Add pause/resume logic.
6. Add dedupe modes.
7. Add `dismiss` / `dismissAll`.
8. Add snapshot subscription API.
9. Build scope registry (instance + provider tracking).
10. Build typed `createToast` factory.
11. Build `ToastProvider` portal renderer.
12. Add motion/accessibility defaults.
13. Add docs and examples.

That sequence minimizes thrash and keeps each step testable.

## 16. Common Mistakes (Avoid These)

1. Coupling toast state directly to React components.
2. Recomputing IDs in renderer.
3. No queue capacity (flooding the viewport).
4. Restarting timers incorrectly after hover.
5. Dedupe based on payload equality instead of explicit `id`.
6. No scope isolation (global/modal collisions).
7. Putting animation logic inside manager (should live in adapter/UI layer).

## 17. Practical Extension Ideas

Once base logic is stable, you can add:

- `update(id, partialPayload/options)` helper
- optional exit animation coordination
- middleware hooks (`onShow`, `onDismiss`)
- persisted toast history (debug mode)
- SSR-safe no-op adapter fallback

Keep each extension behind simple contracts; don’t pollute core state machine with UI concerns.

## 18. Final Build Philosophy

A good toast library is not about flashy UI. It is about predictable behavior under stress:

- burst events
- duplicate updates
- multiple scopes
- hover pauses
- accessibility constraints

If the behavior layer is deterministic, users can design any toast style they want and still trust the system.

> "Minimal surface area, maximal control." That is the right target.
