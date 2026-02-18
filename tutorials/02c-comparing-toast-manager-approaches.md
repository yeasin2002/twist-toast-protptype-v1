# Comparing Toast Manager Approaches (A/B)

## Introduction

This tutorial compares the two implementations:

- **A**: class-based manager (`02-building-the-toast-manager.md`)
- **B**: functional factory manager (`02b-building-the-toast-manager.md`)

The goal is not to declare one style universally correct. The goal is to decide what is better for `twist-toast` as an open-source library with long-term maintenance and multi-framework ambitions.

## What We Are Evaluating

We evaluate both versions across practical criteria:

1. Performance
2. Developer Experience (DX)
3. Maintainability
4. Testability
5. Open-source contributor friendliness
6. Future architecture fit (from the BRD)

## Quick Summary

- **Performance**: Near tie for real toast workloads; B has a slight edge in predictable timer orchestration.
- **DX for contributors**: B is easier to reason about because helpers are pure and side effects are centralized.
- **Maintainability**: B scales better as features grow (dedupe modes, plugins, multi-instance behavior).
- **OSS fit**: B is easier for new contributors to test in isolation and modify safely.
- **Recommendation for `twist-toast`**: **Choose B (functional factory) as the default internal architecture.**

## A/B Comparison Table

| Area | A: Class Manager | B: Functional Manager | Better |
| --- | --- | --- | --- |
| Runtime speed (small queue) | Very good | Very good | Tie |
| Runtime speed (heavier churn) | Good, can duplicate logic paths | Good, central `syncTimers()` reduces drift | B |
| Memory behavior | Good | Good | Tie |
| Bundle impact | Similar | Similar | Tie |
| API clarity | Familiar OO API | Explicit functional API | Tie |
| Internal complexity control | Can sprawl across methods | Pure helpers keep logic local | B |
| Testability | Good | Excellent (state transitions easier to isolate) | B |
| Refactor safety | Medium | High (pure helpers + explicit state) | B |
| Multi-instance isolation | Good | Excellent by default via closure factory | B |
| OSS onboarding | Good for OO users | Better for mixed contributor backgrounds | B |

## Performance Analysis

### What matters for toast systems

- Toast counts are usually low (commonly `<= 5` active)
- Operations are bursty (many adds in a short time)
- Correct timer behavior matters more than micro-optimizing a single method

### A (class) observations

- Uses mutable fields (`this.toasts`, `this.timers`, `this.subscribers`) directly.
- Can be very fast in practice.
- Timer logic is spread across multiple methods, so behavior can drift during feature growth if updates are missed in one method.

### B (functional) observations

- Keeps state in closure with explicit transition helpers.
- Central `syncTimers()` reconciles timers after every mutation.
- Slightly more allocation in immutable-style helpers, but negligible for toast-scale data.

### Verdict on performance

For real-world usage, both are fast enough. B wins by **behavioral performance consistency**: fewer timer edge-case regressions under change.

## Developer Experience (DX)

### A (class)

- Familiar for developers who prefer OO patterns.
- Simple starting point.
- Harder to split logic into independently testable units without extracting static helpers later.

### B (functional)

- No `this` context concerns.
- Pure helpers communicate intent clearly (`addToast`, `removeToast`, `updateToast`, `buildSnapshot`).
- Easier to review PRs because state transitions are explicit and local.

### Verdict on DX

B is stronger for team-based development and long-term contributor ergonomics.

## Maintainability

### A (class) risks over time

- Methods tend to grow as features accumulate.
- Side effects can become scattered (`add`, `dismiss`, `pause`, `resume` each touching timers and state differently).
- Regression risk increases when adding advanced features (refresh dedupe, middleware hooks, debug tooling).

### B (functional) strengths

- Transition helpers can be tested independently.
- Centralized side-effect boundary (`syncTimers`, `notify`) limits accidental divergence.
- Easier to extract framework-agnostic core module for future adapters (Vue/Svelte/Angular phases).

### Verdict on maintainability

B has the better long-term shape for an open-source core package.

## Testability

### A

- Unit tests are straightforward.
- Some behavior verification requires integration-style tests around instance mutation.

### B

- Pure helper tests are very granular and fast.
- Timer behavior is easier to validate deterministically with a single orchestration path.

### Verdict on testability

B is better, especially with strict coverage targets (your BRD target: 90%+).

## Open-Source Project Considerations

When a library is public, code style must optimize for contributor safety, not just personal preference.

Important OSS factors:

1. Reviewability of PRs
2. Ease of writing focused tests
3. Refactor confidence
4. Ability to evolve without API breaks
5. Clarity for first-time contributors

B aligns better with these factors because:

- Data flow is explicit
- Side effects are centralized
- State transitions are easy to snapshot and reason about

## BRD Alignment Check

From your BRD direction:

- `createToast()` factory is the primary integration point
- `<ToastProvider>` should remain thin
- Multiple isolated instances are required
- Future framework adapters are planned

B supports this direction more naturally:

- Each `createToastManager()` call creates isolated closure state
- Framework-agnostic core is easier to keep clean
- Adapter layers can stay thin and declarative

## Weighted Decision Matrix

Suggested scoring model for this project:

- Performance: 20%
- DX (contributors): 20%
- Maintainability: 30%
- Testability: 15%
- OSS scalability: 15%

Scores (1-10):

- A: Performance 8, DX 7, Maintainability 6, Testability 7, OSS scalability 6
- B: Performance 8, DX 8, Maintainability 9, Testability 9, OSS scalability 9

Weighted result:

- **A total: 6.8 / 10**
- **B total: 8.6 / 10**

## Final Recommendation

For `twist-toast`, **choose B (functional manager) as the default internal implementation**.

Use A only if:

1. Your contributor team strongly prefers OO style and accepts higher long-term refactor cost.
2. You optimize for teaching class syntax specifically rather than maintaining a scalable OSS core.

## Practical Next Step

In tutorial 03+, keep public API the same, but build on top of the functional manager:

- `createToast()` composes the manager
- provider subscribes and renders
- tests focus on behavior contracts, not implementation shape

This gives you the best path for performance, DX, and maintainability without changing consumer-facing ergonomics.
