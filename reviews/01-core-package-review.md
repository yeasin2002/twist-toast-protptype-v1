# Core Package Code Review

**Reviewer:** Senior Software Engineer  
**Date:** 2026-02-22  
**Scope:** `packages/core` - Framework-agnostic toast behavior engine  
**Commit Range:** Full codebase review

---

## Executive Summary

**Verdict:** ✅ **Production Ready with Minor Improvements**

The core package demonstrates solid functional programming principles with clean separation of concerns. The architecture is well-thought-out, testable, and genuinely framework-agnostic. However, there are opportunities to simplify the implementation and remove unnecessary complexity.

**Key Strengths:**
- Pure functional state updates
- Excellent testability with dependency injection
- Clean API surface
- Proper timer lifecycle management

**Key Concerns:**
- Over-engineered timer synchronization
- Unnecessary state duplication (`remainingMs` vs computed)
- Missing edge case handling
- Type system could be stricter

---

## Architecture Assessment

### ✅ Strengths

**1. Functional Closure Pattern**
```typescript
export function createToastManager(options) {
  let state: InternalState = { ... }
  const timers = new Map()
  const listeners = new Set()
  
  return { add, dismiss, ... }
}
```
- Clean encapsulation without class overhead
- Private state via closure
- Testable through dependency injection (`now`, `generateId`)

**2. Immutable State Updates**
```typescript
function addToast(state: InternalState, toast: ToastRecord): InternalState {
  const byId = new Map(state.byId)
  byId.set(toast.id, toast)
  return { byId, order: [...state.order, toast.id] }
}
```
- Pure functions for state transitions
- Predictable behavior
- Easy to reason about

**3. Separation of Concerns**
- Core owns behavior logic only
- No UI/rendering concerns
- No framework dependencies
- Truly reusable

### ⚠️ Concerns

**1. Over-Engineered Timer Synchronization**

Current implementation has `syncTimers()` called after every mutation:

```typescript
function add(input: ToastInput): string {
  // ... mutation logic
  syncTimers()  // Full scan of all timers
  notify()
  return id
}
```

**Problem:** `syncTimers()` does two full passes over timers and active toasts on every operation, even when nothing timer-related changed.

**Impact:** O(n) complexity on every mutation, unnecessary work

**Better approach:** Only sync timers when actually needed:
- On add: Only start timer for new toast if it's active
- On dismiss: Only clear timer for dismissed toast
- On queue promotion: Start timer for newly active toast

**2. Redundant State: `remainingMs`**

```typescript
interface ToastRecord {
  duration: number      // Original duration
  createdAt: number     // When created
  remainingMs: number   // Duplicates information
  paused: boolean
}
```

**Problem:** `remainingMs` can be computed from `duration`, `createdAt`, and elapsed time. Storing it creates synchronization burden.

**Why it exists:** To handle pause/resume. But this can be solved differently:

```typescript
interface ToastRecord {
  duration: number
  createdAt: number
  paused: boolean
  pausedAt?: number      // When paused (if paused)
  totalPausedMs: number  // Accumulated pause time
}

// Compute remaining time:
function getRemainingMs(toast: ToastRecord, now: number): number {
  const elapsed = now - toast.createdAt - toast.totalPausedMs
  return Math.max(0, toast.duration - elapsed)
}
```

**Benefits:**
- Single source of truth
- No sync issues
- Simpler pause/resume logic

**3. Missing Edge Cases**

**a) Concurrent timer callbacks:**
```typescript
const handle = setTimeout(() => {
  dismiss(toast.id)  // What if dismiss called manually first?
}, toast.remainingMs)
```

Current code handles this (checks `state.byId.has(id)`), but not explicitly documented.

**b) Negative durations:**
```typescript
const duration = Math.max(0, input.duration)
```
Good! But should this be validated at type level?

**c) Zero-duration toasts:**
Treated as "sticky" (never auto-dismiss). This is correct but undocumented.

**d) maxToasts = 0:**
```typescript
const maxToasts = Math.max(1, options.maxToasts ?? 5)
```
Good defensive programming, but should this throw instead?

---

## SOLID Principles Analysis

### ✅ Single Responsibility Principle
Each function has one clear purpose:
- `addToast` - Add to state
- `syncTimers` - Manage timer lifecycle
- `notify` - Notify subscribers

**Grade: A**

### ✅ Open/Closed Principle
Manager is closed for modification but open for extension via:
- Custom `generateId`
- Custom `now` function
- Dedupe strategies

**Grade: A**

### ⚠️ Liskov Substitution Principle
Not applicable (no inheritance), but interface contracts are solid.

**Grade: N/A**

### ✅ Interface Segregation Principle
`ToastManager` interface is minimal and cohesive. No fat interfaces.

**Grade: A**

### ✅ Dependency Inversion Principle
Depends on abstractions (`now`, `generateId`) not concretions.

**Grade: A**

---

## Functional Programming Principles

### ✅ Pure Functions
State update helpers are pure:
```typescript
function addToast(state, toast): InternalState
function removeToast(state, id): InternalState
```

### ⚠️ Immutability
Mostly immutable, but `state` is mutated in place:
```typescript
state = addToast(state, toast)  // Reassignment, not mutation
```
This is acceptable in closure scope, but could be more explicit.

### ✅ Function Composition
Good separation allows easy composition:
```typescript
state = removeToast(state, id)
syncTimers()
notify()
```

### ⚠️ Side Effects
Side effects (timers, notifications) are isolated but not explicitly marked. Consider:
```typescript
// Pure
function computeNextState(state, action): InternalState

// Impure (side effects)
function performSideEffects(prevState, nextState): void
```

---

## Type Safety Analysis

### ✅ Strong Typing
All public APIs are properly typed.

### ⚠️ Improvements Needed

**1. Stricter Input Validation**
```typescript
export interface ToastInput {
  id?: string
  variant: string        // Should be generic or branded type
  payload: Record<string, unknown>  // Too loose
  duration: number       // Should be non-negative
  position: ToastPosition
  dismissOnClick: boolean
  role: ToastRole
}
```

**Better:**
```typescript
export interface ToastInput<TPayload = unknown> {
  id?: string
  variant: string
  payload: TPayload  // Generic for type safety
  duration: number & { readonly __brand: 'NonNegative' }  // Branded type
  position: ToastPosition
  dismissOnClick: boolean
  role: ToastRole
}
```

**2. Readonly Where Appropriate**
```typescript
export interface ToastState {
  readonly all: readonly ToastRecord[]
  readonly active: readonly ToastRecord[]
  readonly queued: readonly ToastRecord[]
}
```

Prevents accidental mutations by consumers.

---

## Performance Analysis

### ✅ Good Decisions

**1. Map for O(1) lookups:**
```typescript
byId: Map<string, ToastRecord>
```

**2. Separate order array:**
```typescript
order: string[]
```
Preserves insertion order without sorting.

### ⚠️ Optimization Opportunities

**1. Unnecessary Array Copies**
```typescript
function toOrderedToasts(state: InternalState): ToastRecord[] {
  const all: ToastRecord[] = []
  for (const id of state.order) {
    const toast = state.byId.get(id)
    if (toast) {
      all.push(toast)
    }
  }
  return all
}
```

Called on every `getState()`, which is called on every mutation. Consider caching:

```typescript
let cachedSnapshot: ToastState | null = null

function getState(): ToastState {
  if (!cachedSnapshot) {
    cachedSnapshot = createStateSnapshot(state, maxToasts)
  }
  return cachedSnapshot
}

function invalidateCache(): void {
  cachedSnapshot = null
}
```

**2. syncTimers() Overhead**
As mentioned, full scan on every mutation is wasteful.

---

## Test Coverage Analysis

### ✅ Good Coverage

Tests cover:
- Add and notify
- Queue limits
- Dedupe behaviors
- Dismiss operations
- Pause/resume timing

### ⚠️ Missing Tests

**1. Edge Cases:**
- Adding toast while timer callback is executing
- Pausing already-paused toast
- Resuming non-paused toast
- Dismissing non-existent toast (covered implicitly)
- maxToasts = 1 (minimum boundary)
- Very large maxToasts (e.g., 1000)

**2. Concurrent Operations:**
```typescript
it('handles rapid add/dismiss cycles', () => {
  const manager = createToastManager()
  const id1 = manager.add(createInput())
  manager.dismiss(id1)
  const id2 = manager.add(createInput({ id: id1 }))
  expect(id2).toBe(id1)
})
```

**3. Memory Leaks:**
```typescript
it('cleans up timers on destroy', () => {
  const manager = createToastManager()
  manager.add(createInput({ duration: 10000 }))
  manager.destroy()
  // How to verify timers are cleared?
  // Need to spy on clearTimeout
})
```

**4. Subscription Edge Cases:**
```typescript
it('handles unsubscribe during notification', () => {
  const manager = createToastManager()
  let unsub: (() => void) | null = null
  
  unsub = manager.subscribe(() => {
    unsub?.()  // Unsubscribe during callback
  })
  
  manager.add(createInput())  // Should not throw
})
```

---

## API Design Review

### ✅ Excellent API Surface

**Minimal and complete:**
```typescript
interface ToastManager {
  add(input: ToastInput): string
  dismiss(id: string): void
  dismissAll(): void
  pause(id: string): void
  resume(id: string): void
  subscribe(listener: ToastStateListener): () => void
  getState(): ToastState
  destroy(): void
}
```

No unnecessary methods, all essential operations covered.

### ⚠️ Potential Additions for Future

**1. Batch Operations:**
```typescript
addMany(inputs: ToastInput[]): string[]
dismissMany(ids: string[]): void
```

**2. Query Methods:**
```typescript
has(id: string): boolean
get(id: string): ToastRecord | undefined
```

**3. Update Method:**
```typescript
update(id: string, patch: Partial<ToastInput>): void
```

**Note:** These are YAGNI for v1. Only add if React adapter actually needs them.

---

## Specific Issues

### 🔴 Critical: None

### 🟡 Important

**1. Timer Synchronization Over-Engineering**
- **File:** `toast-manager.ts:145-175`
- **Issue:** `syncTimers()` does full scan on every mutation
- **Impact:** Unnecessary O(n) work, harder to maintain
- **Fix:** Targeted timer management per operation

**2. Redundant State (`remainingMs`)**
- **File:** `types.ts:24`, `toast-manager.ts:190-195`
- **Issue:** Duplicates information, creates sync burden
- **Impact:** More complex pause/resume, potential bugs
- **Fix:** Compute from `duration`, `createdAt`, `totalPausedMs`

**3. Missing Input Validation**
- **File:** `toast-manager.ts:180-185`
- **Issue:** No validation that `position`, `role` are valid
- **Impact:** Runtime errors if invalid values passed
- **Fix:** Runtime validation or stricter types

### 🟢 Minor

**1. Magic Number: maxToasts Default**
- **File:** `toast-manager.ts:95`
- **Issue:** `5` is hardcoded, not documented
- **Fix:** Export as constant: `export const DEFAULT_MAX_TOASTS = 5`

**2. Undocumented Behavior: Zero Duration**
- **File:** `toast-manager.ts:186`
- **Issue:** `duration: 0` means "sticky" but not documented
- **Impact:** Confusing for consumers
- **Fix:** Add JSDoc comment

**3. No Logging/Debugging Support**
- **File:** All
- **Issue:** No way to debug timer issues in production
- **Impact:** Hard to diagnose issues
- **Fix:** Optional debug callback in options

**4. Default ID Generation Collision Risk**
- **File:** `toast-manager.ts:88-90`
- **Issue:** `Math.random()` has collision risk at scale
- **Impact:** Low probability but possible
- **Fix:** Use crypto.randomUUID() if available, or better algorithm

---

## Recommendations

### High Priority

**1. Simplify Timer Management**

Replace `syncTimers()` with targeted operations:

```typescript
function startTimerIfNeeded(id: string): void {
  const toast = state.byId.get(id)
  if (!toast || timers.has(id) || toast.paused || 
      toast.duration <= 0 || !isActiveToast(id)) {
    return
  }
  
  const remaining = getRemainingMs(toast, now())
  if (remaining <= 0) return
  
  const handle = setTimeout(() => dismiss(id), remaining)
  timers.set(id, { handle, startedAt: now() })
}

function stopTimer(id: string): void {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer.handle)
    timers.delete(id)
  }
}
```

Then in operations:
```typescript
function add(input: ToastInput): string {
  // ... add logic
  startTimerIfNeeded(id)
  notify()
  return id
}

function dismiss(id: string): void {
  stopTimer(id)
  state = removeToast(state, id)
  promoteQueuedToast()  // Start timer for newly active
  notify()
}
```

**2. Remove `remainingMs` from State**

```typescript
interface ToastRecord {
  id: string
  variant: string
  payload: Record<string, unknown>
  duration: number
  position: ToastPosition
  dismissOnClick: boolean
  role: ToastRole
  createdAt: number
  paused: boolean
  pausedAt?: number
  totalPausedMs: number
}

function getRemainingMs(toast: ToastRecord, now: number): number {
  if (toast.paused && toast.pausedAt) {
    const elapsed = toast.pausedAt - toast.createdAt - toast.totalPausedMs
    return Math.max(0, toast.duration - elapsed)
  }
  const elapsed = now - toast.createdAt - toast.totalPausedMs
  return Math.max(0, toast.duration - elapsed)
}
```

**3. Add Input Validation**

```typescript
function validateInput(input: ToastInput): void {
  if (input.duration < 0) {
    throw new Error('duration must be non-negative')
  }
  if (!VALID_POSITIONS.includes(input.position)) {
    throw new Error(`Invalid position: ${input.position}`)
  }
  if (!VALID_ROLES.includes(input.role)) {
    throw new Error(`Invalid role: ${input.role}`)
  }
}
```

### Medium Priority

**4. Add Readonly Modifiers**

Make state snapshots immutable:
```typescript
export interface ToastState {
  readonly all: readonly ToastRecord[]
  readonly active: readonly ToastRecord[]
  readonly queued: readonly ToastRecord[]
}
```

**5. Export Constants**

```typescript
export const DEFAULT_MAX_TOASTS = 5
export const DEFAULT_DEDUPE: DedupeBehavior = 'ignore'
```

**6. Add JSDoc Comments**

Document public API and non-obvious behavior:
```typescript
/**
 * Creates a toast manager instance.
 * 
 * @param options - Configuration options
 * @param options.maxToasts - Maximum visible toasts (default: 5, min: 1)
 * @param options.dedupe - How to handle duplicate IDs (default: 'ignore')
 * @param options.now - Time function for testing (default: Date.now)
 * @param options.generateId - ID generator for testing
 * 
 * @example
 * const manager = createToastManager({ maxToasts: 3 })
 * const id = manager.add({
 *   variant: 'success',
 *   payload: { message: 'Saved!' },
 *   duration: 4000,  // 0 = sticky (never auto-dismiss)
 *   position: 'top-right',
 *   dismissOnClick: true,
 *   role: 'status'
 * })
 */
```

### Low Priority

**7. Better ID Generation**

```typescript
function defaultGenerateId(now: () => number): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `toast-${now()}-${Math.random().toString(36).slice(2, 10)}`
}
```

**8. Debug Mode**

```typescript
interface CreateToastManagerOptions {
  // ... existing
  debug?: (event: string, data: unknown) => void
}

// Usage:
if (options.debug) {
  options.debug('toast:added', { id, variant })
}
```

---

## Simplification Opportunities

### Can Be Removed

**Nothing.** The core is already minimal. Every piece serves a purpose.

### Can Be Simplified

**1. `toOrderedToasts` + `createStateSnapshot`**

These could be combined:
```typescript
function getState(): ToastState {
  const all: ToastRecord[] = []
  for (const id of state.order) {
    const toast = state.byId.get(id)
    if (toast) all.push(toast)
  }
  
  return {
    all,
    active: all.slice(0, maxToasts),
    queued: all.slice(maxToasts),
  }
}
```

**2. `isActiveToast` Helper**

Only used in one place. Inline it:
```typescript
function pause(id: string): void {
  const toast = state.byId.get(id)
  const isActive = getState().active.some(t => t.id === id)
  if (!toast || toast.paused || toast.duration <= 0 || !isActive) {
    return
  }
  // ...
}
```

---

## Future-Proofing Assessment

### ✅ Well-Positioned for Future

**1. Multi-Framework Support**
Core is truly framework-agnostic. Can easily add:
- Vue adapter
- Svelte adapter
- Angular adapter

**2. Feature Extensions**
Easy to add without breaking changes:
- Priority levels (add `priority` to `ToastRecord`)
- Grouping (add `group` to `ToastRecord`)
- Progress tracking (add `progress` to `ToastRecord`)

**3. Persistence**
Could add persistence layer without core changes:
```typescript
const manager = createToastManager()
const persisted = withPersistence(manager, localStorage)
```

### ⚠️ Potential Breaking Changes Needed

**1. Generic Payload Type**
Current `payload: Record<string, unknown>` is too loose. Future version should:
```typescript
export interface ToastInput<TPayload = unknown> {
  // ...
  payload: TPayload
}
```

This is breaking but necessary for proper type safety.

**2. Readonly State**
Adding `readonly` modifiers is technically breaking (consumers mutating state would break).

---

## Comparison with Industry Standards

### vs. react-hot-toast
- **Simpler:** No built-in animations, smaller API
- **More flexible:** Truly headless, no CSS opinions
- **Better typed:** Stronger type inference in React adapter

### vs. sonner
- **More explicit:** No magic, clear behavior
- **More testable:** Dependency injection built-in
- **Less opinionated:** No default styling

### vs. react-toastify
- **Smaller:** No runtime dependencies
- **Cleaner:** Functional vs class-based
- **More modern:** TypeScript-first

---

## Final Assessment

### Production Readiness: ✅ YES

The core package is production-ready with minor improvements.

### Code Quality: A-

- Architecture: A
- Type Safety: B+
- Performance: B+
- Testability: A
- Maintainability: A-

### Recommended Actions Before v1.0

**Must Fix:**
- None (already production-ready)

**Should Fix:**
- Simplify timer synchronization
- Remove `remainingMs` redundancy
- Add input validation

**Nice to Have:**
- Add JSDoc comments
- Export constants
- Add readonly modifiers
- Improve ID generation

### Estimated Refactoring Effort

- Timer simplification: 2-3 hours
- Remove `remainingMs`: 1-2 hours
- Add validation: 30 minutes
- Documentation: 1 hour

**Total: 4-6 hours**

---

## Conclusion

The core package demonstrates excellent software engineering principles. It's clean, testable, and genuinely framework-agnostic. The main issues are over-engineering (timer sync) and redundant state (`remainingMs`), both of which can be simplified without breaking the public API.

The architecture is sound and well-positioned for future growth. With minor refinements, this is a solid foundation for a production toast library.

**Recommendation:** Ship it with the suggested improvements, or ship as-is and refactor in v1.1.
