# Cross-Cutting Concerns Review

**Reviewer:** Senior Software Engineer  
**Date:** 2026-02-22  
**Scope:** Architecture, patterns, and concerns spanning both packages

---

## Executive Summary

This review examines concerns that affect both packages: architectural decisions, design patterns, future extensibility, and overall project health.

**Key Findings:**
- Clean separation between core and adapter
- Some duplication that could be eliminated
- Missing features that will be needed soon
- Good foundation for multi-framework support

---

## Architecture: Core vs. React Separation

### ✅ Excellent Separation

The boundary between core and React is clean:

**Core owns:**
- State management
- Queue logic
- Timer orchestration
- Dedupe behavior
- Subscriptions

**React owns:**
- Type inference
- Factory API
- Rendering
- Lifecycle/transitions
- Interaction wiring

**No leakage:** Core has zero React dependencies. React imports from core but doesn't modify it.

**Grade: A**

### ⚠️ Potential Issues

**1. Payload Type Mismatch**

Core:
```typescript
interface ToastInput {
  payload: Record<string, unknown>  // Loose
}
```

React:
```typescript
type ExtractPayload<TComponent> = Omit<...>  // Strict
```

React's type system is stricter than core's. This works but creates a type gap.

**Future problem:** If core adds payload validation, it won't match React's types.

**Fix:** Make core generic:
```typescript
interface ToastInput<TPayload = unknown> {
  payload: TPayload
}
```

**2. Variant Type Mismatch**

Core:
```typescript
interface ToastInput {
  variant: string  // Any string
}
```

React:
```typescript
type ToastInstance<TComponents extends ToastComponentsMap> = {
  [TVariant in keyof TComponents]: ...  // Specific keys
}
```

React enforces variant names at type level, but core accepts any string.

**Future problem:** Runtime errors if invalid variant passed to core directly.

**Fix:** Make core generic or add runtime validation:
```typescript
function add(input: ToastInput): string {
  if (!isValidVariant(input.variant)) {
    throw new Error(`Unknown variant: ${input.variant}`)
  }
  // ...
}
```

But this requires React to pass valid variants to core, which it already does. So this is YAGNI.

---

## Design Patterns Analysis

### ✅ Well-Applied Patterns

**1. Factory Pattern (React)**
```typescript
const toast = createToast(components, options)
```
- Encapsulates instance creation
- Provides clean API
- Enables type inference

**2. Observer Pattern (Core)**
```typescript
manager.subscribe(listener)
```
- Decouples state from consumers
- Supports multiple listeners
- Standard pub/sub

**3. Strategy Pattern (Core)**
```typescript
dedupe: 'ignore' | 'refresh'
```
- Configurable behavior
- Easy to extend with new strategies

**4. Portal Pattern (React)**
```typescript
createPortal(content, portalRoot)
```
- Standard React pattern for overlays
- Avoids z-index issues

### ⚠️ Questionable Patterns

**1. Registry Pattern (React)**

As discussed in React review, this is clever but adds complexity:
- Global mutable state
- Memory leak potential
- Testing complexity

**Alternative:** Context pattern is more React-idiomatic.

**2. Closure-Based Manager (Core)**

```typescript
export function createToastManager(options) {
  let state = { ... }
  const timers = new Map()
  
  return { add, dismiss, ... }
}
```

**Pros:**
- Encapsulation
- No class overhead
- Testable

**Cons:**
- Can't extend via inheritance (but do we need to?)
- Can't inspect internal state (but we have `getState()`)

**Verdict:** This is fine. Functional approach is appropriate for this use case.

---

## Code Duplication Analysis

### ⚠️ Duplication Found

**1. Default Values**

Core:
```typescript
const maxToasts = Math.max(1, options.maxToasts ?? 5)
const dedupe = options.dedupe ?? 'ignore'
```

React:
```typescript
const DEFAULT_DURATION = 4000
const DEFAULT_POSITION = 'top-right'
const DEFAULT_DISMISS_ON_CLICK = true
const DEFAULT_ROLE = 'status'
```

**Issue:** Defaults are split across packages. If core adds defaults for position/role, they'll conflict.

**Fix:** Core should own all defaults:
```typescript
// core/src/defaults.ts
export const DEFAULT_MAX_TOASTS = 5
export const DEFAULT_DEDUPE = 'ignore'
export const DEFAULT_DURATION = 4000
export const DEFAULT_POSITION = 'top-right'
export const DEFAULT_DISMISS_ON_CLICK = true
export const DEFAULT_ROLE = 'status'
```

React imports and uses them:
```typescript
import { DEFAULT_DURATION, DEFAULT_POSITION } from '@twist-toast/core'
```

**2. Type Definitions**

Core:
```typescript
export type ToastPosition = 'top-left' | 'top-center' | ...
export type ToastRole = 'alert' | 'status'
```

React:
```typescript
import type { ToastPosition, ToastRole } from '@twist-toast/core'
```

This is correct! No duplication here.

**3. Position Styles**

React:
```typescript
const positionStyles: Record<ToastPosition, CSSProperties> = {
  'top-left': { top: 0, left: 0, ... },
  // ...
}
```

This is React-specific (CSS), so it belongs in React package. No duplication issue.

---

## Missing Features Analysis

### 🟡 Will Be Needed Soon

**1. Toast Update**

Currently, you can't update a toast after creation:
```typescript
const id = toast.success({ message: 'Saving...' })
// Later: want to update to "Saved!"
// No way to do this!
```

**Use cases:**
- Progress indicators
- Multi-step operations
- Error recovery

**Fix:** Add to core:
```typescript
interface ToastManager {
  // ... existing
  update(id: string, patch: Partial<ToastInput>): void
}
```

React:
```typescript
interface ToastInstance {
  // ... existing
  update(id: string, payload: Partial<TPayload>): void
}
```

**Priority:** Medium (will be requested by users)

**2. Promise-Based Toasts**

Common pattern:
```typescript
const id = toast.loading({ message: 'Saving...' })

try {
  await save()
  toast.update(id, { variant: 'success', message: 'Saved!' })
} catch (error) {
  toast.update(id, { variant: 'error', message: 'Failed!' })
}
```

Or even better:
```typescript
toast.promise(save(), {
  loading: { message: 'Saving...' },
  success: { message: 'Saved!' },
  error: { message: 'Failed!' },
})
```

**Priority:** Medium (nice DX improvement)

**3. Toast Groups**

For related toasts:
```typescript
toast.success({ message: 'File 1 uploaded', group: 'uploads' })
toast.success({ message: 'File 2 uploaded', group: 'uploads' })

// Dismiss all in group:
toast.dismissGroup('uploads')
```

**Priority:** Low (can work around with manual tracking)

**4. Persistent Toasts**

Toasts that survive page refresh:
```typescript
const toast = createToast(components, {
  persist: true,
  storage: localStorage,
})
```

**Priority:** Low (niche use case)

**5. Toast Actions**

Built-in action buttons:
```typescript
toast.info({
  message: 'New version available',
  actions: [
    { label: 'Update', onClick: () => update() },
    { label: 'Dismiss', onClick: () => {} },
  ],
})
```

**Priority:** Low (users can add to their components)

### ✅ Correctly Excluded (YAGNI)

**1. Built-in Animations**
Users own the UI. Correct decision.

**2. Default Toast Components**
Would lock users into a design. Correct decision.

**3. Sound Effects**
Niche feature. Correct to exclude.

**4. Toast History**
Can be built on top if needed. Correct to exclude.

---

## Testing Strategy Analysis

### ⚠️ Insufficient Coverage

**Current state:**
- Core: Good coverage of behavior
- React: Minimal smoke test

**Missing:**
- Integration tests (core + React together)
- E2E tests (real browser)
- Performance tests
- Accessibility tests

### Recommended Test Structure

```
tests/
├── unit/
│   ├── core/
│   │   ├── toast-manager.test.ts  ✅ Exists
│   │   ├── state-updates.test.ts
│   │   └── timer-edge-cases.test.ts
│   └── react/
│       ├── create-toast.test.tsx
│       ├── provider.test.tsx
│       ├── lifecycle.test.tsx
│       └── type-inference.test.ts
├── integration/
│   ├── core-react.test.tsx
│   ├── multiple-instances.test.tsx
│   └── error-handling.test.tsx
├── e2e/
│   ├── basic-flow.spec.ts
│   ├── interactions.spec.ts
│   └── accessibility.spec.ts
└── performance/
    ├── many-toasts.test.ts
    └── rapid-operations.test.ts
```

**Priority:** High (insufficient tests for production)

---

## Documentation Analysis

### ✅ Good Internal Docs

The `/docs` folder has excellent implementation documentation:
- Clear explanations of design decisions
- Step-by-step rebuild guides
- Rationale for tradeoffs

**Grade: A**

### ⚠️ Missing User Docs

**What's missing:**
1. API reference
2. Migration guide (from other libraries)
3. Troubleshooting guide
4. Performance guide
5. Accessibility guide
6. Examples gallery

**Priority:** High (needed for v1.0 release)

### ⚠️ Missing Code Comments

**Core:**
```typescript
function syncTimers(): void {
  // No comment explaining the two-pass algorithm
  // ...
}
```

**React:**
```typescript
interface RenderedToast {
  toast: ToastRecord
  phase: ToastRenderPhase  // No comment explaining lifecycle
}
```

**Fix:** Add JSDoc comments to public APIs and complex logic.

**Priority:** Medium

---

## Accessibility Analysis

### ✅ Good Foundation

**ARIA attributes:**
```typescript
role={toast.role}
aria-live={getAriaLive(toast.role)}
```

Correct use of `role` and `aria-live`.

### ⚠️ Missing Features

**1. Keyboard Navigation**

No keyboard support:
- Can't focus toasts
- Can't dismiss with Escape
- Can't navigate between toasts with Tab

**Fix:**
```typescript
<div
  role={toast.role}
  aria-live={getAriaLive(toast.role)}
  tabIndex={0}  // Make focusable
  onKeyDown={(e) => {
    if (e.key === 'Escape') dismiss()
  }}
>
```

**Priority:** High (accessibility requirement)

**2. Screen Reader Announcements**

Current implementation relies on `aria-live`, which is correct. But:
- No way to customize announcement text
- No way to prevent announcement (for silent updates)

**Fix:**
```typescript
interface ToastInput {
  // ... existing
  ariaLabel?: string  // Custom announcement
  ariaLive?: 'polite' | 'assertive' | 'off'  // Override default
}
```

**Priority:** Medium

**3. Reduced Motion**

As mentioned in React review, no support for `prefers-reduced-motion`.

**Priority:** High (accessibility requirement)

**4. Focus Management**

When toast appears, focus doesn't move. This is usually correct (don't steal focus), but for critical alerts, you might want to:

```typescript
interface ToastInput {
  // ... existing
  autoFocus?: boolean  // Move focus to toast
}
```

**Priority:** Low (niche use case)

---

## Performance Considerations

### ✅ Good Decisions

**1. Map for O(1) lookups** (Core)
**2. Separate order array** (Core)
**3. useMemo for position buckets** (React)

### ⚠️ Potential Issues

**1. No Virtualization**

If you have 100 toasts queued, all 100 are in memory (though only `maxToasts` are rendered).

**Impact:** Low (unlikely to have 100 toasts)

**Fix:** Add queue limit:
```typescript
interface CreateToastManagerOptions {
  maxToasts?: number      // Max visible
  maxQueued?: number      // Max in queue (default: Infinity)
}
```

**Priority:** Low

**2. No Batching**

If you add 10 toasts in a loop:
```typescript
for (let i = 0; i < 10; i++) {
  toast.success({ message: `Item ${i}` })
}
```

This triggers 10 separate state updates and 10 re-renders.

**Fix:** Add batch API:
```typescript
toast.batch(() => {
  for (let i = 0; i < 10; i++) {
    toast.success({ message: `Item ${i}` })
  }
})
```

**Priority:** Low (rare use case)

**3. Registry Snapshot Recreation**

As mentioned in React review, every toast operation recreates the registry snapshot.

**Priority:** Medium (affects all instances)

---

## Security Analysis

### ✅ No Major Concerns

**1. No XSS Risk**

User-provided content is rendered via React components, which escape by default:
```typescript
<div>{message}</div>  // Safe
```

If users do:
```typescript
<div dangerouslySetInnerHTML={{ __html: message }} />  // Unsafe
```

That's their responsibility.

**2. No Injection Risk**

No dynamic code execution or eval.

**3. No Sensitive Data**

Toast content is ephemeral and not persisted (unless user adds persistence).

### ⚠️ Minor Concerns

**1. ID Collision**

Default ID generation uses `Math.random()`:
```typescript
`toast-${now()}-${Math.random().toString(36).slice(2, 10)}`
```

**Risk:** Low probability collision could cause toast to be replaced unexpectedly.

**Impact:** Low (annoying but not security issue)

**Fix:** Use `crypto.randomUUID()` if available.

**Priority:** Low

---

## Bundle Size Analysis

### Current Size (Estimated)

**Core:**
- Source: ~300 lines
- Minified: ~2 KB
- Gzipped: ~1 KB

**React:**
- Source: ~500 lines
- Minified: ~4 KB
- Gzipped: ~2 KB

**Total: ~3 KB gzipped**

### ✅ Excellent

This is very small for a toast library. Comparable libraries:
- react-hot-toast: ~5 KB
- react-toastify: ~15 KB
- sonner: ~8 KB

**Grade: A+**

### Optimization Opportunities

**1. Tree Shaking**

Current exports are tree-shakeable:
```typescript
export { createToast, ToastProvider }
```

If you only use `createToast`, `ToastProvider` code is eliminated.

**2. Code Splitting**

Could split provider into separate chunk:
```typescript
// Lazy load provider
const ToastProvider = lazy(() => import('./ToastProvider'))
```

But this is YAGNI. Provider is small and usually needed.

---

## Multi-Framework Readiness

### ✅ Core is Ready

Core has zero framework dependencies. Adding Vue/Svelte/Angular adapters would be straightforward:

**Vue adapter:**
```typescript
// @twist-toast/vue
export function createToast(components, options) {
  const manager = createToastManager(options)
  
  return {
    success: (payload) => manager.add({ variant: 'success', payload, ... }),
    // ...
  }
}

export const ToastProvider = defineComponent({
  setup() {
    const instances = ref(getInstancesSnapshot())
    onMounted(() => subscribeToRegistry(() => {
      instances.value = getInstancesSnapshot()
    }))
    // ...
  }
})
```

**Svelte adapter:**
```typescript
// @twist-toast/svelte
export function createToast(components, options) {
  const manager = createToastManager(options)
  // Similar to React
}

// ToastProvider.svelte
<script>
  import { onMount } from 'svelte'
  import { getInstancesSnapshot, subscribeToRegistry } from './registry'
  
  let instances = getInstancesSnapshot()
  onMount(() => subscribeToRegistry(() => {
    instances = getInstancesSnapshot()
  }))
</script>

{#each instances as entry}
  <ManagerToasts manager={entry.manager} components={entry.components} />
{/each}
```

**Verdict:** Core is well-designed for multi-framework support.

---

## Monorepo Structure Analysis

### ✅ Good Organization

```
packages/
├── core/       # Framework-agnostic
└── react/      # React adapter

tooling/
├── eslint-config/
└── typescript-config/
```

Clean separation, shared tooling.

### ⚠️ Future Considerations

**When adding more adapters:**

```
packages/
├── core/
├── react/
├── vue/
├── svelte/
└── shared/     # Shared adapter utilities?
```

**Shared utilities might include:**
- Registry pattern (if reused)
- Portal helpers
- Lifecycle management

**Priority:** Low (wait until second adapter)

---

## Breaking Changes Needed

### Before v1.0

**1. Make Core Generic**

```typescript
// Current:
interface ToastInput {
  payload: Record<string, unknown>
}

// Better:
interface ToastInput<TPayload = unknown> {
  payload: TPayload
}
```

**Impact:** Breaking change for direct core users (but React adapter handles it)

**2. Add Readonly Modifiers**

```typescript
export interface ToastState {
  readonly all: readonly ToastRecord[]
  readonly active: readonly ToastRecord[]
  readonly queued: readonly ToastRecord[]
}
```

**Impact:** Breaking if consumers mutate state (which they shouldn't)

**3. Rename `dismissOnClick` to `closeOnClick`**

More conventional naming.

**Impact:** Breaking API change

**Priority:** Low (current name is fine)

---

## Recommendations Summary

### Must Fix Before v1.0

1. **Add error boundary** (React) - Critical
2. **Fix registry memory leak** (React) - Critical
3. **Add keyboard navigation** - Accessibility requirement
4. **Add reduced motion support** - Accessibility requirement
5. **Add comprehensive tests** - Production requirement

### Should Fix Before v1.0

6. **Simplify timer synchronization** (Core)
7. **Remove `remainingMs` redundancy** (Core)
8. **Combine state updates** (React)
9. **Add input validation** (Core)
10. **Add JSDoc comments** (Both)

### Consider for v1.1

11. **Add toast update API**
12. **Add promise-based toasts**
13. **Make transition duration configurable**
14. **Add portal target option**
15. **Optimize registry snapshot**

### Consider for v2.0

16. **Make core generic** (breaking)
17. **Add readonly modifiers** (breaking)
18. **Replace registry with context** (breaking)
19. **Simplify lifecycle management** (breaking)

---

## Estimated Effort

**Must fix:** 12-15 hours
**Should fix:** 8-10 hours
**Total for v1.0:** 20-25 hours

---

## Final Verdict

### Overall Grade: B+

**Strengths:**
- Clean architecture
- Excellent type inference
- Small bundle size
- Good separation of concerns
- Well-positioned for growth

**Weaknesses:**
- Insufficient tests
- Missing accessibility features
- Some over-engineering
- Memory leak potential

### Production Ready?

**Yes, after fixing critical issues:**
1. Error boundary
2. Memory leak
3. Keyboard navigation
4. Reduced motion

**Timeline:** 1-2 days of focused work

### Recommendation

This is solid work with a good foundation. The architecture is sound and the type inference is impressive. With the critical fixes, this is ready for production use.

The suggested refactorings (timer sync, lifecycle simplification) can wait for v1.1 or v2.0. Ship v1.0 with the critical fixes, gather user feedback, then refactor based on real-world usage.

**Ship it!** (after critical fixes)
