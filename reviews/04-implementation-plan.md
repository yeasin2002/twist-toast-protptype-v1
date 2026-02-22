# Implementation Plan: Critical Fixes

**Goal:** Make twist-toast production-ready by fixing critical issues  
**Estimated Effort:** 20-25 hours  
**Priority Order:** Critical → Important → Nice to Have

---

## Phase 1: Critical Fixes (12-15 hours)

### 1. Add Error Boundary (React) - 1 hour

**File:** `packages/react/src/ToastErrorBoundary.tsx` (new)

**Implementation:**

```typescript
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  onError: (error: Error) => void;
}

interface State {
  hasError: boolean;
}

export class ToastErrorBoundary extends Component<Props, State> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[twist-toast] Toast component error:", error);
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}
```

**Changes to ToastProvider.tsx:**

- Import and wrap each toast in error boundary
- Pass dismiss callback to auto-remove broken toasts

**Test:** Create toast that throws, verify app doesn't crash

---

### 2. Fix Registry Memory Leak (React) - 30 minutes

**File:** `packages/react/src/registry.ts`

**Add:**

```typescript
export function unregisterInstance(instance: object): void {
  const id = instanceIds.get(instance);
  if (!id) return;

  entries.delete(id);
  instanceIds.delete(instance);
  emitChange();
}
```

**File:** `packages/react/src/create-toast.ts`

**Add destroy method:**

```typescript
const instance = {
  ...methods,
  dismiss,
  dismissAll,
  destroy() {
    manager.destroy();
    unregisterInstance(instance);
  },
};
```

**Test:** Create instance, call destroy, verify registry cleaned up

---

### 3. Add Keyboard Navigation (React) - 1 hour

**File:** `packages/react/src/ToastProvider.tsx`

**Changes:**

```typescript
<div
  role={toast.role}
  aria-live={getAriaLive(toast.role)}
  tabIndex={0}  // Make focusable
  onKeyDown={(e) => {
    if (e.key === 'Escape') {
      dismiss()
    }
  }}
  style={getToastStyle(toast.position, item.phase)}
>
```

**Test:**

- Tab to toast, verify focus
- Press Escape, verify dismissal
- Test with screen reader

---

### 4. Add Reduced Motion Support (React) - 30 minutes

**File:** `packages/react/src/ToastProvider.tsx`

**Add at top of component:**

```typescript
const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

useEffect(() => {
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  setPrefersReducedMotion(mediaQuery.matches);

  const handler = (e: MediaQueryListEvent) => {
    setPrefersReducedMotion(e.matches);
  };

  mediaQuery.addEventListener("change", handler);
  return () => mediaQuery.removeEventListener("change", handler);
}, []);

const transitionDuration = prefersReducedMotion ? 0 : TRANSITION_DURATION_MS;
```

**Update transition styles:**

```typescript
transition: prefersReducedMotion
  ? "none"
  : `opacity ${transitionDuration}ms ease, transform ${transitionDuration}ms ease`;
```

**Test:** Toggle reduced motion in OS, verify transitions disabled

---

### 5. Add Comprehensive Tests (React) - 8-10 hours

**New test files:**

**a) `packages/react/tests/create-toast.test.tsx`** (2 hours)

- Type inference validation
- Method generation
- Options merging
- Multiple instances

**b) `packages/react/tests/provider.test.tsx`** (2 hours)

- Portal creation
- Multiple instances rendering
- Position grouping
- Cleanup on unmount

**c) `packages/react/tests/lifecycle.test.tsx`** (2 hours)

- Enter → visible → exit phases
- Exit timer cleanup
- Hover pause/resume
- Click dismiss

**d) `packages/react/tests/error-handling.test.tsx`** (1 hour)

- Component errors caught
- Toast auto-dismissed on error
- App doesn't crash

**e) `packages/react/tests/accessibility.test.tsx`** (2 hours)

- ARIA attributes correct
- Keyboard navigation works
- Reduced motion respected
- Screen reader announcements

**f) `packages/react/tests/integration.test.tsx`** (1 hour)

- Core + React together
- Real-world scenarios
- Edge cases

---

## Phase 2: Important Fixes (8-10 hours)

### 6. Simplify Timer Synchronization (Core) - 2-3 hours

**Current problem:** `syncTimers()` scans all timers on every operation

**New approach:** Targeted timer management

**File:** `packages/core/src/toast-manager.ts`

**Replace `syncTimers()` with:**

```typescript
function startTimer(id: string): void {
  const toast = state.byId.get(id);
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
  if (remaining <= 0) return;

  const startedAt = now();
  const handle = setTimeout(() => dismiss(id), remaining);
  timers.set(id, { handle, startedAt });
}

function stopTimer(id: string): void {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer.handle);
    timers.delete(id);
  }
}

function promoteQueuedToast(): void {
  const snapshot = getState();
  const newlyActive = snapshot.active.find((t) => !timers.has(t.id));
  if (newlyActive) {
    startTimer(newlyActive.id);
  }
}
```

**Update operations:**

```typescript
function add(input: ToastInput): string {
  // ... existing logic
  startTimer(id); // Instead of syncTimers()
  notify();
  return id;
}

function dismiss(id: string): void {
  stopTimer(id);
  state = removeToast(state, id);
  promoteQueuedToast(); // Start timer for newly active
  notify();
}
```

**Test:** Verify all existing tests still pass

---

### 7. Remove `remainingMs` Redundancy (Core) - 1-2 hours

**File:** `packages/core/src/types.ts`

**Update ToastRecord:**

```typescript
export interface ToastRecord extends Omit<ToastInput, "id" | "duration"> {
  id: string;
  duration: number;
  createdAt: number;
  paused: boolean;
  pausedAt?: number;
  totalPausedMs: number;
}
```

**Add helper:**

```typescript
function getRemainingMs(toast: ToastRecord, now: number): number {
  if (toast.paused && toast.pausedAt) {
    const elapsed = toast.pausedAt - toast.createdAt - toast.totalPausedMs;
    return Math.max(0, toast.duration - elapsed);
  }
  const elapsed = now - toast.createdAt - toast.totalPausedMs;
  return Math.max(0, toast.duration - elapsed);
}
```

**Update pause/resume:**

```typescript
function pause(id: string): void {
  const toast = state.byId.get(id);
  if (!toast || toast.paused || toast.duration <= 0 || !isActiveToast(id)) {
    return;
  }

  stopTimer(id);
  state = updateToast(state, id, {
    paused: true,
    pausedAt: now(),
  });
  notify();
}

function resume(id: string): void {
  const toast = state.byId.get(id);
  if (!toast || !toast.paused || !toast.pausedAt) {
    return;
  }

  const pauseDuration = now() - toast.pausedAt;
  state = updateToast(state, id, {
    paused: false,
    pausedAt: undefined,
    totalPausedMs: toast.totalPausedMs + pauseDuration,
  });
  startTimer(id);
  notify();
}
```

**Test:** Verify pause/resume still works correctly

---

### 8. Combine State Updates (React) - 1 hour

**File:** `packages/react/src/ToastProvider.tsx`

**Current problem:** Two state updates per operation

**Fix:** Reconcile in subscription callback

```typescript
useEffect(() => {
  return manager.subscribe((state) => {
    setRenderedToasts((prev) => {
      const activeById = new Map(state.active.map((t) => [t.id, t]));
      const next: RenderedToast[] = [];
      const seen = new Set<string>();

      // Update existing
      for (const item of prev) {
        const activeToast = activeById.get(item.toast.id);
        if (activeToast) {
          next.push({
            toast: activeToast,
            phase: item.phase === "exit" ? "visible" : item.phase,
          });
        } else {
          next.push({ toast: item.toast, phase: "exit" });
        }
        seen.add(item.toast.id);
      }

      // Add new
      for (const toast of state.active) {
        if (!seen.has(toast.id)) {
          next.push({ toast, phase: "enter" });
        }
      }

      return next;
    });
  });
}, [manager]);
```

**Remove:** Separate reconciliation effect

**Test:** Verify lifecycle still works, count renders

---

### 9. Add Input Validation (Core) - 30 minutes

**File:** `packages/core/src/toast-manager.ts`

**Add validation:**

```typescript
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
    throw new Error("duration must be non-negative");
  }
  if (!VALID_POSITIONS.includes(input.position)) {
    throw new Error(`Invalid position: ${input.position}`);
  }
  if (!VALID_ROLES.includes(input.role)) {
    throw new Error(`Invalid role: ${input.role}`);
  }
}

function add(input: ToastInput): string {
  validateInput(input);
  // ... rest of logic
}
```

**Test:** Verify invalid inputs throw errors

---

### 10. Add JSDoc Comments (Both) - 2-3 hours

**Files:** All public APIs

**Example for core:**

````typescript
/**
 * Creates a toast manager instance for managing toast notifications.
 *
 * The manager handles state, queueing, timers, and subscriptions.
 * It's framework-agnostic and can be used with any UI library.
 *
 * @param options - Configuration options
 * @param options.maxToasts - Maximum visible toasts (default: 5, min: 1)
 * @param options.dedupe - Deduplication strategy (default: 'ignore')
 *   - 'ignore': Keep existing toast, ignore new one with same ID
 *   - 'refresh': Remove existing, add new toast with same ID
 * @param options.now - Time function for testing (default: Date.now)
 * @param options.generateId - ID generator for testing
 *
 * @returns Toast manager instance
 *
 * @example
 * ```typescript
 * const manager = createToastManager({ maxToasts: 3 })
 *
 * const id = manager.add({
 *   variant: 'success',
 *   payload: { message: 'Saved!' },
 *   duration: 4000,  // 0 = sticky (never auto-dismiss)
 *   position: 'top-right',
 *   dismissOnClick: true,
 *   role: 'status'
 * })
 *
 * manager.dismiss(id)
 * ```
 */
export function createToastManager(
  options: CreateToastManagerOptions = {},
): ToastManager {
  // ...
}
````

**Example for React:**

````typescript
/**
 * Creates a typed toast instance from component definitions.
 *
 * Type inference automatically determines required/optional payload props
 * from your component prop types, providing full type safety.
 *
 * @param components - Map of variant names to React components
 * @param options - Configuration options
 *
 * @returns Typed toast instance with methods for each variant
 *
 * @example
 * ```typescript
 * const toast = createToast({
 *   success: ({ message }: { message: string }) => <div>{message}</div>,
 *   error: ({ message, retry }: { message: string; retry?: () => void }) => (
 *     <div>{message}</div>
 *   ),
 * })
 *
 * toast.success({ message: 'Saved!' })  // message required
 * toast.error({ message: 'Failed' })     // retry optional
 * ```
 */
export function createToast<TComponents extends ToastComponentsMap>(
  components: TComponents,
  options: CreateToastOptions = {},
): ToastInstance<TComponents> {
  // ...
}
````

---

## Phase 3: Nice to Have (Optional)

### 11. Export Constants (Core) - 15 minutes

**File:** `packages/core/src/defaults.ts` (new)

```typescript
export const DEFAULT_MAX_TOASTS = 5;
export const DEFAULT_DEDUPE: DedupeBehavior = "ignore";
export const DEFAULT_DURATION = 4000;
export const DEFAULT_POSITION: ToastPosition = "top-right";
export const DEFAULT_DISMISS_ON_CLICK = true;
export const DEFAULT_ROLE: ToastRole = "status";
```

**Update both packages to import these**

---

### 12. Better ID Generation (Core) - 15 minutes

```typescript
function defaultGenerateId(now: () => number): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `toast-${now()}-${Math.random().toString(36).slice(2, 10)}`;
}
```

---

### 13. Make Transition Duration Configurable (React) - 30 minutes

**Add to CreateToastOptions:**

```typescript
interface CreateToastOptions {
  // ... existing
  transitionDuration?: number;
}
```

**Pass to provider via registry**

---

### 14. Add Portal Target Option (React) - 1 hour

**Add to ToastProviderProps:**

```typescript
interface ToastProviderProps {
  children: ReactNode;
  portalTarget?: HTMLElement | (() => HTMLElement);
}
```

---

## Testing Strategy

### Unit Tests

- Core: Extend existing tests for new validation
- React: New test files for each concern

### Integration Tests

- Core + React working together
- Multiple instances
- Error scenarios

### E2E Tests (Optional)

- Playwright tests for real browser
- Accessibility testing with axe

### Performance Tests (Optional)

- Many toasts benchmark
- Rapid operations benchmark

---

## Documentation Tasks

### User Documentation

1. API reference
2. Getting started guide
3. Migration guide
4. Troubleshooting
5. Accessibility guide
6. Examples gallery

### Code Documentation

1. JSDoc comments on all public APIs
2. Complex logic explanations
3. Type system documentation

---

## Timeline

### Week 1: Critical Fixes

- Day 1-2: Error boundary, memory leak, keyboard nav
- Day 3: Reduced motion, test setup
- Day 4-5: Write comprehensive tests

### Week 2: Important Fixes

- Day 1-2: Timer simplification, remove remainingMs
- Day 3: Combine state updates, validation
- Day 4-5: JSDoc comments, polish

### Week 3: Documentation & Polish

- Day 1-3: User documentation
- Day 4-5: Examples, final testing

### Week 4: Beta & Release

- Day 1-3: Beta testing, bug fixes
- Day 4-5: Final polish, v1.0 release

---

## Success Criteria

### Must Have (v1.0)

- ✅ All critical issues fixed
- ✅ Test coverage >80%
- ✅ No accessibility violations
- ✅ User documentation complete
- ✅ No memory leaks
- ✅ Bundle size <5KB

### Nice to Have (v1.1)

- Toast update API
- Promise-based helpers
- Configurable transitions
- Custom portal target

### Future (v2.0)

- Context-based architecture
- Simplified lifecycle
- Generic core types
- Multi-framework support

---

## Risk Mitigation

### Breaking Changes

- Keep public API stable
- Add features, don't remove
- Deprecate before removing

### Performance

- Benchmark before/after refactoring
- Monitor bundle size
- Profile with React DevTools

### Compatibility

- Test with React 17, 18, 19
- Test with different bundlers
- Test SSR scenarios

---

## Next Steps

1. Review this plan
2. Prioritize fixes
3. Create feature branches
4. Implement phase 1
5. Test thoroughly
6. Repeat for phases 2-3
