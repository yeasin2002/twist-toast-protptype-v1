# React Package Code Review

**Reviewer:** Senior Software Engineer  
**Date:** 2026-02-22  
**Scope:** `packages/react` - React adapter for twist-toast  
**Commit Range:** Full codebase review

---

## Executive Summary

**Verdict:** ✅ **Production Ready with Improvements**

The React package demonstrates sophisticated TypeScript type inference and clean React patterns. The factory pattern with type inference is impressive. However, there are concerns about complexity in the lifecycle management and potential performance issues with the registry pattern.

**Key Strengths:**

- Excellent TypeScript type inference
- Zero-config provider pattern
- Clean separation from core
- Smooth transition animations

**Key Concerns:**

- Over-complex lifecycle state management
- Registry pattern may not scale
- Potential performance issues with re-renders
- Missing error boundaries

---

## Architecture Assessment

### ✅ Strengths

**1. Type Inference System**

The type system is genuinely impressive:

```typescript
type ExtractPayload<TComponent> = Omit<
  ExtractComponentProps<TComponent>,
  "dismiss" | "toastId"
>;

type VariantMethod<TComponent> =
  RequiredKeys<ExtractPayload<TComponent>> extends never
    ? (payload?, options?) => string
    : (payload, options?) => string;
```

This provides full type safety from component definitions to method calls. Well done.

**2. Factory Pattern**

```typescript
const toast = createToast({
  success: SuccessToast,
  error: ErrorToast,
});

toast.success({ message: "Saved!" }); // Fully typed!
```

Clean API, no context hooks needed, stable imports. Excellent DX.

**3. Portal Rendering**

```typescript
const root = document.createElement("div");
root.setAttribute("data-twist-toast-root", "");
document.body.appendChild(root);
```

Avoids z-index hell and overflow issues. Good decision.

### ⚠️ Concerns

**1. Over-Complex Lifecycle Management**

The three-phase lifecycle (`enter` → `visible` → `exit`) adds significant complexity:

```typescript
interface RenderedToast {
  toast: ToastRecord;
  phase: ToastRenderPhase; // 'enter' | 'visible' | 'exit'
}
```

**Why it exists:** To enable CSS transitions.

**Problem:** This is a lot of state management for a simple fade-in/fade-out.

**Analysis:**

- Separate `renderedToasts` state from core state
- Multiple `useEffect` hooks to manage phase transitions
- `exitTimers` map to track unmounting
- `requestAnimationFrame` for enter → visible transition

**Is this necessary?** Let's evaluate alternatives:

**Alternative 1: CSS-only transitions**

```css
[data-twist-toast] {
  animation: slideIn 180ms ease;
}

[data-twist-toast][data-removing] {
  animation: slideOut 180ms ease;
}
```

**Problem:** Can't delay unmount without JS.

**Alternative 2: React Transition Group**

```typescript
<TransitionGroup>
  {toasts.map(toast => (
    <CSSTransition key={toast.id} timeout={180}>
      <ToastView {...toast} />
    </CSSTransition>
  ))}
</TransitionGroup>
```

**Problem:** Adds dependency, but simpler than custom solution.

**Problem:** Heavy dependency for simple fade.

**Verdict:** Current approach is reasonable for zero-dependency goal, but could be simplified. See recommendations.

**2. Registry Pattern Scalability**

```typescript
const instanceIds = new WeakMap<object, string>();
const entries = new Map<string, ToastRegistryEntry>();
const listeners = new Set<RegistryListener>();
let snapshot: ToastRegistryEntry[] = [];
```

**Concerns:**

a) **Global mutable state** - Not ideal in React
b) **All instances in one array** - Provider renders all instances even if only one changed
c) **No cleanup mechanism** - Instances never removed from registry
d) **Testing complexity** - Requires `__resetRegistryForTests()` hack

**Why it exists:** To enable zero-config provider.

**Is it worth it?** Let's evaluate:

**Benefit:** Provider needs no props

```typescript
<ToastProvider>  {/* No props! */}
  <App />
</ToastProvider>
```

**Cost:** Global state, potential memory leaks, testing complexity

**Alternative:** Context-based approach

```typescript
const toast = createToast(components)

<ToastProvider instance={toast}>
  <App />
</ToastProvider>
```

**Tradeoff:** Requires passing instance, but simpler and more React-idiomatic.

**Verdict:** Registry pattern is clever but may not be worth the complexity. Consider context-based approach for v2.

**3. Performance Concerns**

**a) Provider Re-renders**

```typescript
const instances = useSyncExternalStore(
  subscribeToRegistry,
  getInstancesSnapshot,
)

return (
  <>
    {instances.map(entry => (
      <ManagerToasts key={entry.id} manager={entry.manager} />
    ))}
  </>
)
```

Every registry change (any instance adding a toast) causes provider to re-render and re-map all instances.

**Impact:** Low for typical usage (1-2 instances), but could be issue with many instances.

**b) ManagerToasts Re-renders**

```typescript
const [state, setState] = useState(() => manager.getState());
const [renderedToasts, setRenderedToasts] = useState([]);

useEffect(() => {
  return manager.subscribe(setState);
}, [manager]);

useEffect(() => {
  // Reconcile renderedToasts with state.active
  setRenderedToasts(/* complex logic */);
}, [state.active]);
```

Two state updates per toast change:

1. `setState` from manager subscription
2. `setRenderedToasts` from reconciliation effect

**Impact:** Extra render per toast operation.

**c) Position Buckets Recalculation**

```typescript
const groupedToasts = useMemo(
  () => getPositionBuckets(renderedToasts),
  [renderedToasts],
);
```

Recalculates on every `renderedToasts` change. This is fine, but could be optimized if needed.

---

## SOLID Principles Analysis

### ✅ Single Responsibility Principle

**createToast:** Factory for typed instances  
**ToastProvider:** Rendering and lifecycle  
**registry:** Instance tracking

Clear separation. **Grade: A**

### ⚠️ Open/Closed Principle

Hard to extend without modifying:

- Can't customize transition duration
- Can't customize portal target
- Can't customize position styles

**Grade: B**

### ✅ Liskov Substitution Principle

N/A (no inheritance)

### ✅ Interface Segregation Principle

Clean interfaces, no fat types. **Grade: A**

### ⚠️ Dependency Inversion Principle

Depends on concrete DOM APIs (`document.createElement`, `document.body`).

Could abstract:

```typescript
interface DOMAdapter {
  createPortalRoot(): HTMLElement;
  appendToBody(el: HTMLElement): void;
}
```

But this is YAGNI for v1. **Grade: B+**

---

## React Best Practices

### ✅ Good Practices

**1. useSyncExternalStore**

```typescript
const instances = useSyncExternalStore(
  subscribeToRegistry,
  getInstancesSnapshot,
);
```

Correct use of React 18 API for external state.

**2. Cleanup Effects**

```typescript
useEffect(() => {
  return () => {
    for (const handle of exitTimers.current.values()) {
      clearTimeout(handle);
    }
  };
}, []);
```

Proper cleanup of timers.

**3. Stable Callbacks**

```typescript
const dismiss = () => manager.dismiss(toast.id);
```

Inline functions are fine here (not passed as props to memoized children).

### ⚠️ Concerns

**1. Missing Error Boundary**

```typescript
<ToastProvider>
  <App />
</ToastProvider>
```

If a toast component throws, it could crash the entire app.

**Fix:**

```typescript
class ToastErrorBoundary extends React.Component {
  componentDidCatch(error, info) {
    console.error('Toast render error:', error)
    // Dismiss the problematic toast
  }

  render() {
    return this.props.children
  }
}

// Wrap each toast:
<ToastErrorBoundary>
  <ToastView {...props} />
</ToastErrorBoundary>
```

**2. No SSR Support**

```typescript
useEffect(() => {
  if (typeof document === "undefined") {
    return undefined;
  }
  // ...
}, []);
```

Good check, but provider renders nothing on server. This means:

- Hydration mismatch if toasts exist on mount
- No SSR for toast content

**Is this a problem?** Probably not. Toasts are typically client-side only.

**3. Potential Memory Leak in Registry**

```typescript
export function registerInstance(
  instance: object,
  manager: ToastManager,
  components: ToastComponentsMap,
): void {
  // ...
  entries.set(id, { id, manager, components });
  emitChange();
}
```

No `unregisterInstance` function. If you create many toast instances dynamically, they'll never be cleaned up.

**Fix:**

```typescript
export function unregisterInstance(instance: object): void {
  const id = instanceIds.get(instance);
  if (id) {
    entries.delete(id);
    emitChange();
  }
}

// In createToast:
return {
  ...methods,
  dismiss,
  dismissAll,
  destroy() {
    manager.destroy();
    unregisterInstance(instance);
  },
};
```

---

## Type Safety Analysis

### ✅ Excellent Type Inference

The type system is the star of this package:

```typescript
const toast = createToast({
  success: ({ message }: { message: string }) => <div>{message}</div>,
  error: ({ message, retry }: { message: string; retry?: () => void }) => (
    <div>{message}</div>
  ),
})

toast.success({ message: 'Hi' })  // ✅ Required
toast.success()                    // ❌ Error: message required

toast.error({ message: 'Oops' })   // ✅ retry optional
toast.error({ message: 'Oops', retry: () => {} })  // ✅
```

This is genuinely impressive TypeScript work.

### ⚠️ Minor Issues

**1. `any` in ToastComponentsMap**

```typescript
export type ToastComponentsMap = Record<string, ToastComponent<any>>;
```

The `any` is necessary for the map, but could be `unknown`:

```typescript
export type ToastComponentsMap = Record<string, ToastComponent<any>>;
```

Actually, `any` is correct here because we need contravariance. This is fine.

**2. Type Assertion in Provider**

```typescript
const ToastView = components[toast.variant] as ToastComponent | undefined;
```

Could be avoided with better typing, but this is pragmatic.

---

## Performance Analysis

### ⚠️ Potential Issues

**1. Double State Updates**

Every toast operation triggers:

1. Manager state update → `setState`
2. Reconciliation effect → `setRenderedToasts`

**Impact:** Two renders per operation.

**Fix:** Combine into single state update:

```typescript
const [renderedToasts, setRenderedToasts] = useState([]);

useEffect(() => {
  return manager.subscribe((state) => {
    setRenderedToasts((prev) => reconcile(prev, state.active));
  });
}, [manager]);
```

**2. Registry Snapshot Recreation**

```typescript
function emitChange(): void {
  snapshot = Array.from(entries.values()); // New array every time
  for (const listener of listeners) {
    listener();
  }
}
```

Every toast operation in any instance recreates the snapshot array.

**Impact:** Causes provider to re-render even if its instances didn't change.

**Fix:** Only recreate if entries actually changed:

```typescript
function emitChange(): void {
  const newSnapshot = Array.from(entries.values());
  if (shallowEqual(snapshot, newSnapshot)) {
    return;
  }
  snapshot = newSnapshot;
  for (const listener of listeners) {
    listener();
  }
}
```

**3. Position Styles Object Creation**

```typescript
const positionStyles: Record<ToastPosition, CSSProperties> = {
  "top-left": {
    /* ... */
  },
  // ...
};
```

This is fine (created once per module), but the container styles are recreated on every render:

```typescript
const containerStyle: CSSProperties = {
  position: "absolute",
  // ...
  ...positionStyles[position],
};
```

**Fix:** Memoize or move outside component:

```typescript
const getContainerStyle = (position: ToastPosition): CSSProperties => ({
  position: "absolute",
  display: "flex",
  gap: "0.5rem",
  maxWidth: "min(420px, calc(100vw - 1rem))",
  padding: "0.5rem",
  pointerEvents: "none",
  ...positionStyles[position],
});

// Cache:
const containerStyleCache = new Map<ToastPosition, CSSProperties>();
```

---

## Test Coverage Analysis

### ⚠️ Insufficient Coverage

Current test:

```typescript
it("renders and dismisses a toast", () => {
  // Basic smoke test
});
```

**Missing tests:**

**1. Type Inference Tests**

```typescript
it('enforces required payload props', () => {
  const toast = createToast({
    success: ({ message }: { message: string }) => <div />,
  })

  // @ts-expect-error - message is required
  toast.success()

  // Should compile
  toast.success({ message: 'Hi' })
})
```

**2. Multiple Instances**

```typescript
it('renders multiple toast instances independently', () => {
  const toast1 = createToast({ info: InfoToast })
  const toast2 = createToast({ success: SuccessToast })

  render(
    <ToastProvider>
      <button onClick={() => toast1.info({ message: 'A' })}>A</button>
      <button onClick={() => toast2.success({ message: 'B' })}>B</button>
    </ToastProvider>
  )

  // Both should render independently
})
```

**3. Lifecycle Phases**

```typescript
it("transitions through enter -> visible -> exit phases", () => {
  // Test data-state attributes
});
```

**4. Error Handling**

```typescript
it('handles toast component errors gracefully', () => {
  const BrokenToast = () => {
    throw new Error('Broken!')
  }

  const toast = createToast({ broken: BrokenToast })

  render(<ToastProvider><App /></ToastProvider>)

  toast.broken({})

  // Should not crash app
})
```

**5. Memory Leaks**

```typescript
it('cleans up registry on unmount', () => {
  const toast = createToast({ info: InfoToast })
  const { unmount } = render(<ToastProvider />)

  toast.info({ message: 'Hi' })
  unmount()

  // Registry should be cleaned up
  expect(getInstancesSnapshot()).toHaveLength(0)
})
```

**6. Hover Pause/Resume**

```typescript
it("pauses on hover and resumes on leave", () => {
  // Test interaction wiring
});
```

---

## Specific Issues

### 🔴 Critical

**1. Missing Error Boundary**

- **File:** `ToastProvider.tsx:220-230`
- **Issue:** Toast component errors can crash entire app
- **Impact:** Production crashes from user-defined components
- **Fix:** Wrap each toast in error boundary

**2. Registry Memory Leak**

- **File:** `registry.ts:35-50`
- **Issue:** No cleanup mechanism for instances
- **Impact:** Memory leak if creating instances dynamically
- **Fix:** Add `unregisterInstance` and call on destroy

### 🟡 Important

**3. Double Renders on Toast Operations**

- **File:** `ToastProvider.tsx:95-115`
- **Issue:** Two state updates per operation
- **Impact:** Unnecessary re-renders, potential performance issue
- **Fix:** Combine state updates in subscription callback

**4. No SSR Hydration Strategy**

- **File:** `ToastProvider.tsx:200-210`
- **Issue:** Provider renders nothing on server
- **Impact:** Hydration mismatch if toasts on mount
- **Fix:** Document SSR limitations or add hydration support

**5. Hardcoded Transition Duration**

- **File:** `ToastProvider.tsx:45`
- **Issue:** `TRANSITION_DURATION_MS = 180` not configurable
- **Impact:** Can't customize animations
- **Fix:** Add to `CreateToastOptions`

**6. No Reduced Motion Support**

- **File:** `ToastProvider.tsx:130-140`
- **Issue:** Ignores `prefers-reduced-motion`
- **Impact:** Accessibility issue
- **Fix:** Check media query and skip transitions

### 🟢 Minor

**7. Magic Number: Max Width**

- **File:** `ToastProvider.tsx:175`
- **Issue:** `min(420px, calc(100vw - 1rem))` hardcoded
- **Impact:** Can't customize container width
- **Fix:** Add to options or CSS variable

**8. No Portal Target Customization**

- **File:** `ToastProvider.tsx:205`
- **Issue:** Always appends to `document.body`
- **Impact:** Can't render in custom container
- **Fix:** Add `portalTarget` option

**9. Inline Styles for Transitions**

- **File:** `ToastProvider.tsx:130-140`
- **Issue:** Transition styles are inline, can't override
- **Impact:** Limited customization
- **Fix:** Use CSS variables or data attributes

---

## Recommendations

### High Priority

**1. Add Error Boundary**

```typescript
class ToastErrorBoundary extends React.Component<
  { children: ReactNode; onError: (error: Error) => void },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error)
  }

  render() {
    if (this.state.hasError) {
      return null  // Don't render broken toast
    }
    return this.props.children
  }
}

// Usage:
<ToastErrorBoundary onError={() => manager.dismiss(toast.id)}>
  <ToastView {...props} />
</ToastErrorBoundary>
```

**2. Fix Registry Memory Leak**

```typescript
export function unregisterInstance(instance: object): void {
  const id = instanceIds.get(instance);
  if (!id) return;

  entries.delete(id);
  instanceIds.delete(instance);
  emitChange();
}

// In createToast return value:
const instance = {
  ...methods,
  dismiss,
  dismissAll,
  [Symbol.dispose]() {
    // TC39 proposal
    manager.destroy();
    unregisterInstance(instance);
  },
};
```

**3. Combine State Updates**

```typescript
useEffect(() => {
  return manager.subscribe((state) => {
    setRenderedToasts((prev) => {
      // Reconcile in subscription callback
      return reconcileToasts(prev, state.active);
    });
  });
}, [manager]);
```

**4. Add Reduced Motion Support**

```typescript
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

const TRANSITION_DURATION_MS = prefersReducedMotion ? 0 : 180;

// Or:
const transitionStyle = prefersReducedMotion
  ? {}
  : {
      transition: `opacity 180ms ease, transform 180ms ease`,
      willChange: "opacity, transform",
    };
```

### Medium Priority

**5. Make Transition Duration Configurable**

```typescript
interface CreateToastOptions {
  // ... existing
  transitionDuration?: number;
}

// In provider:
const duration = options.transitionDuration ?? 180;
```

**6. Add Portal Target Option**

```typescript
interface ToastProviderProps {
  children: ReactNode;
  portalTarget?: HTMLElement | (() => HTMLElement);
}
```

**7. Optimize Registry Snapshot**

```typescript
function emitChange(): void {
  const newSnapshot = Array.from(entries.values());

  // Only update if actually changed
  if (
    snapshot.length === newSnapshot.length &&
    snapshot.every((entry, i) => entry === newSnapshot[i])
  ) {
    return;
  }

  snapshot = newSnapshot;
  for (const listener of listeners) {
    listener();
  }
}
```

### Low Priority

**8. Add JSDoc Comments**

Document the type inference magic:

```typescript
/**
 * Creates a typed toast instance from component definitions.
 *
 * Type inference automatically determines required/optional payload props
 * from your component prop types.
 *
 * @example
 * const toast = createToast({
 *   success: ({ message }: { message: string }) => <div>{message}</div>,
 *   error: ({ message, retry }: { message: string; retry?: () => void }) => (
 *     <div>{message}</div>
 *   ),
 * })
 *
 * toast.success({ message: 'Saved!' })  // message required
 * toast.error({ message: 'Failed' })     // retry optional
 */
```

**9. Export Utility Types**

```typescript
export type { ExtractPayload, RequiredKeys, VariantMethod };
```

Users might want these for advanced use cases.

**10. Add Debug Mode**

```typescript
interface CreateToastOptions {
  debug?: boolean;
}

// Log lifecycle events:
if (options.debug) {
  console.log("[toast] Phase transition:", toast.id, phase);
}
```

---

## Simplification Opportunities

### Can Be Simplified

**1. Lifecycle State Management**

Current approach has 4 effects managing lifecycle. Could be reduced to 2:

```typescript
// Effect 1: Subscribe to manager
useEffect(() => {
  return manager.subscribe((state) => {
    setRenderedToasts((prev) => reconcileWithPhases(prev, state.active));
  });
}, [manager]);

// Effect 2: Cleanup exit timers
useEffect(() => {
  return () => {
    for (const handle of exitTimers.current.values()) {
      clearTimeout(handle);
    }
  };
}, []);
```

**2. Position Bucket Calculation**

```typescript
function getPositionBuckets(toasts) {
  const buckets = new Map();
  for (const item of toasts) {
    const position = item.toast.position;
    const current = buckets.get(position);
    if (current) {
      current.push(item);
      continue;
    }
    buckets.set(position, [item]);
  }
  return buckets;
}
```

Could use `Array.reduce`:

```typescript
function getPositionBuckets(toasts) {
  return toasts.reduce((buckets, item) => {
    const position = item.toast.position;
    const current = buckets.get(position) ?? [];
    buckets.set(position, [...current, item]);
    return buckets;
  }, new Map());
}
```

But current version is more readable. Keep it.

### Cannot Be Simplified

**Type inference system** - Already minimal for what it achieves  
**Factory pattern** - Clean and necessary  
**Portal rendering** - Standard React pattern

---

## Alternative Architectures

### Option 1: Context-Based (Simpler)

```typescript
const ToastContext = createContext<ToastInstance | null>(null)

export function ToastProvider({ instance, children }) {
  return (
    <ToastContext.Provider value={instance}>
      {children}
      <ToastRenderer instance={instance} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast must be used within ToastProvider')
  return toast
}
```

**Pros:**

- No global registry
- More React-idiomatic
- Easier to test
- No memory leaks

**Cons:**

- Requires passing instance
- Can't use toast outside React tree (but is this needed?)

**Verdict:** Consider for v2.

### Option 2: Render Props (More Flexible)

```typescript
<ToastProvider>
  {({ toast }) => (
    <App toast={toast} />
  )}
</ToastProvider>
```

**Pros:**

- Explicit dependency
- No global state

**Cons:**

- Awkward API
- Requires prop drilling

**Verdict:** Not recommended.

### Option 3: Hybrid (Best of Both)

```typescript
// Support both patterns:
const toast = createToast(components)

// Pattern 1: Global (current)
<ToastProvider>
  <App />
</ToastProvider>

// Pattern 2: Explicit
<ToastProvider instance={toast}>
  <App />
</ToastProvider>

// If instance provided, only render that instance
// If no instance, use registry (current behavior)
```

**Verdict:** Good compromise for v2.

---

## Comparison with Industry Standards

### vs. react-hot-toast

**Similarities:**

- Factory pattern
- Headless approach
- TypeScript-first

**Differences:**

- react-hot-toast has simpler lifecycle (no three phases)
- react-hot-toast uses context, not registry
- twist-toast has better type inference

### vs. sonner

**Similarities:**

- Modern React patterns
- Smooth animations

**Differences:**

- sonner has opinionated styling
- sonner uses context
- twist-toast is more flexible

### vs. react-toastify

**Similarities:**

- Portal rendering
- Position-based layout

**Differences:**

- react-toastify is class-based
- react-toastify has built-in styles
- twist-toast has better TypeScript

---

## Final Assessment

### Production Readiness: ⚠️ YES (with fixes)

The React package is production-ready after fixing critical issues (error boundary, memory leak).

### Code Quality: B+

- Architecture: A-
- Type Safety: A+
- Performance: B
- Testability: C+
- Maintainability: B+

### Recommended Actions Before v1.0

**Must Fix:**

1. Add error boundary around toast components
2. Fix registry memory leak

**Should Fix:** 3. Combine state updates to avoid double renders 4. Add reduced motion support 5. Add more comprehensive tests

**Nice to Have:** 6. Make transition duration configurable 7. Add portal target option 8. Add JSDoc comments

### Estimated Refactoring Effort

- Error boundary: 1 hour
- Memory leak fix: 30 minutes
- Combine state updates: 1 hour
- Reduced motion: 30 minutes
- Tests: 3-4 hours
- Documentation: 1 hour

**Total: 7-8 hours**

---

## Conclusion

The React package demonstrates excellent TypeScript skills and clean React patterns. The type inference system is genuinely impressive and provides great DX.

The main concerns are:

1. **Lifecycle complexity** - Three-phase system is sophisticated but complex
2. **Registry pattern** - Clever but may not scale, potential memory leaks
3. **Test coverage** - Insufficient for production
4. **Error handling** - Missing error boundary

The architecture is sound but could be simplified. The registry pattern, while enabling zero-config, adds complexity that may not be worth it. Consider context-based approach for v2.

**Recommendation:** Fix critical issues (error boundary, memory leak), add tests, then ship. Consider architectural simplification in v2.

**Overall:** This is good work. With the suggested fixes, it's production-ready. The type inference alone makes this library stand out.
