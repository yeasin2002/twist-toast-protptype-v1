# Transition Animation Fix (`@twist-toast/react`)

## 1. Problem Observed

Toasts were appearing and disappearing instantly with no smooth transition.

Visible symptoms:

- enter animation never showed
- dismiss looked abrupt
- no time for CSS transitions on unmount

## 2. Root Cause

Before the fix, provider rendering was tied directly to `state.active`:

- when toast was added, node was rendered immediately in final state
- when toast was dismissed, node was removed from DOM immediately

A CSS transition cannot run if:

- the initial visual state is never rendered, or
- the node is removed before exit transition completes

## 3. Fix Strategy

Add a small render lifecycle inside `ToastProvider` only (no core API change).

New local state model in `ManagerToasts`:

- `RenderedToast = { toast, phase }`
- phases: `enter`, `visible`, `exit`

Behavior:

1. New active toast enters with phase `enter`.
2. On next animation frame, phase flips to `visible`.
3. Removed active toast stays rendered as `exit`.
4. After transition duration timeout, exit toast is unmounted.

## 4. Implementation Details

Implemented in `packages/react/src/ToastProvider.tsx`.

Key additions:

- `TRANSITION_DURATION_MS = 180`
- `renderedToasts` state separate from manager `active` state
- `requestAnimationFrame` for `enter -> visible`
- `exitTimers` map for delayed unmount of exiting toasts
- cleanup effect to clear timers on unmount

Style behavior:

- `opacity: 0 -> 1` on enter
- `opacity: 1 -> 0` on exit
- small `translate3d` offset based on position
- `pointerEvents: none` while exiting

## 5. Why This Was Done in React Layer

Core should remain UI-agnostic and deterministic.

Transition lifecycle is presentation behavior, so it belongs in the adapter/UI layer.

Benefits:

- no API expansion needed in core
- avoids coupling business logic with animation timing
- different adapters can implement different animation strategies

## 6. Data-State Improvements

`data-state` now communicates visual phase:

- `entering`
- `active`
- `paused`
- `exiting`

This supports user-defined styling hooks while keeping library headless.

## 7. Test Update

Updated `packages/react/tests/toast-react.test.tsx`:

- switched to fake timers
- after click dismiss, advance timers before asserting DOM removal

Why:

- exiting toast intentionally stays mounted for transition duration
- test must reflect real lifecycle behavior

## 8. What Else Was Considered

Alternative options evaluated:

- add built-in CSS classes file
- add animation flags/timing to core API
- use third-party transition library

Reasons these were not chosen for v1:

- would reduce headless flexibility
- would increase dependency/runtime complexity
- would blur core vs UI responsibilities

## 9. Future Extensions

Potential improvements without breaking architecture:

- expose transition duration/easing in React options
- add reduced-motion behavior (`prefers-reduced-motion`)
- optional spring physics variant in adapter layer
