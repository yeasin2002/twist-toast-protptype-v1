# React Package Guide (`@twist-toast/react`)

## Overview

The `@twist-toast/react` package is the React adapter for twist-toast. It transforms the framework-agnostic core into a type-safe, developer-friendly React API with zero-config setup and full design control.

## Package Information

- **Name**: `@twist-toast/react`
- **Type**: ESM module
- **Peer Dependencies**: React ≥18, React DOM ≥18
- **Internal Dependencies**: `@twist-toast/core` (workspace)
- **Bundle Target**: Minimal runtime overhead, tree-shakeable

## Architecture

The React package consists of five key modules:

1. **types.ts** - TypeScript inference system
2. **create-toast.ts** - Factory function for typed toast instances
3. **registry.ts** - Global instance tracking for zero-config provider
4. **ToastProvider.tsx** - Portal-based rendering with lifecycle management
5. **index.ts** - Public API exports

## Public API

### Exports

```typescript
// Factory function
export { createToast } from "./create-toast";

// Provider component
export { ToastProvider } from "./ToastProvider";

// TypeScript types
export type {
  CreateToastOptions,
  ToastCallOptions,
  ToastComponent,
  ToastComponentProps,
  ToastComponentsMap,
  ToastInstance,
};
```

### Type System

The React package uses advanced TypeScript to provide full type inference from your component definitions.

#### Core Types

**ToastComponentProps<TPayload>**

```typescript
type ToastComponentProps<TPayload extends object = EmptyPayload> = TPayload & {
  dismiss: () => void;
  toastId: string;
};
```

Every toast component receives:

- User-defined payload props
- `dismiss()` function to close the toast
- `toastId` string for identification

**ToastComponent<TPayload>**

```typescript
type ToastComponent<TPayload extends object = EmptyPayload> = ComponentType<
  ToastComponentProps<TPayload>
>;
```

A React component that accepts `ToastComponentProps`.

**ToastComponentsMap**

```typescript
type ToastComponentsMap = Record<string, ToastComponent<any>>;
```

A map of variant names to toast components.

#### Type Inference Utilities

**ExtractPayload<TComponent>**

Extracts the payload type from a component by removing injected props (`dismiss`, `toastId`).

**RequiredKeys<T>**

Identifies which keys in a type are required (not optional).

**VariantMethod<TComponent>**

Generates the correct method signature based on whether the payload has required props:

- If all props are optional: `(payload?, options?) => string`
- If any props are required: `(payload, options?) => string`

**ToastInstance<TComponents>**

The final instance type with:

- One method per variant with inferred payload types
- Shared `dismiss(id)` and `dismissAll()` methods

### createToast()

Factory function that creates a typed toast instance.

#### Signature

```typescript
function createToast<TComponents extends ToastComponentsMap>(
  components: TComponents,
  options?: CreateToastOptions,
): ToastInstance<TComponents>;
```

#### Parameters

**components** (required)

Map of variant names to React components:

```typescript
const components = {
  success: SuccessToast,
  error: ErrorToast,
  info: InfoToast,
};
```

**options** (optional)

```typescript
interface CreateToastOptions {
  // Default duration in milliseconds (default: 4000)
  defaultDuration?: number;

  // Default position (default: 'top-right')
  defaultPosition?: ToastPosition;

  // Default dismiss on click behavior (default: true)
  defaultDismissOnClick?: boolean;

  // Default ARIA role (default: 'status')
  defaultRole?: ToastRole;

  // Maximum visible toasts (default: 3)
  maxToasts?: number;

  // Deduplication strategy (default: 'ignore')
  dedupe?: DedupeBehavior;

  // Custom time function for testing
  now?: () => number;

  // Custom ID generator for testing
  generateId?: () => string;
}
```

#### Return Value

A `ToastInstance` with:

- Type-safe variant methods (e.g., `toast.success()`, `toast.error()`)
- `dismiss(id: string)` - Dismiss specific toast
- `dismissAll()` - Dismiss all toasts

#### Internal Flow

1. Extract core manager options from React options
2. Create core `ToastManager` instance
3. Resolve default values for duration, position, dismissOnClick, role
4. Generate variant methods by iterating component map
5. Each method:
   - Merges call options with defaults
   - Normalizes payload to object
   - Builds `ToastInput` for core manager
   - Calls `manager.add()` and returns toast ID
6. Add shared control methods
7. Register instance in global registry
8. Return typed instance

### ToastProvider

Zero-config provider component that renders all toast instances.

#### Signature

```typescript
function ToastProvider({ children }: { children: ReactNode }): JSX.Element;
```

#### Usage

```typescript
import { ToastProvider } from '@twist-toast/react'

function App() {
  return (
    <ToastProvider>
      <YourApp />
    </ToastProvider>
  )
}
```

#### Rendering Strategy

1. Creates portal root in `document.body` on mount
2. Subscribes to global registry using `useSyncExternalStore`
3. Renders one `ManagerToasts` component per registered toast instance
4. Each manager:
   - Subscribes to its manager state
   - Groups active toasts by position
   - Renders toast wrappers with lifecycle management
   - Injects props and wires interactions

#### Portal Structure

```html
<body>
  <div id="root"><!-- Your app --></div>
  <div data-twist-toast-root>
    <!-- Toast containers by position -->
  </div>
</body>
```

#### Position Containers

Toasts are grouped into position-specific containers:

- `top-left`, `top-center`, `top-right`
- `bottom-left`, `bottom-center`, `bottom-right`

Each container:

- Uses absolute positioning
- Applies flexbox layout
- Reverses flex direction for bottom positions
- Constrains max width to `min(420px, calc(100vw - 1rem))`

### ToastCallOptions

Per-call options that override defaults:

```typescript
interface ToastCallOptions {
  duration?: number; // Override default duration
  position?: ToastPosition; // Override default position
  dismissOnClick?: boolean; // Override default dismiss behavior
  role?: ToastRole; // Override default ARIA role
  id?: string; // Explicit ID for deduplication
}
```

## Lifecycle Management

### Render Phases

The provider implements a three-phase lifecycle for smooth transitions:

1. **enter** - Toast just added, initial state
2. **visible** - Toast fully visible, active state
3. **exit** - Toast dismissed, exiting state

### Phase Transitions

**Enter → Visible**

- Triggered via `requestAnimationFrame` after render
- Allows CSS transition from hidden to visible state
- Opacity: 0 → 1
- Transform: offset → translate3d(0, 0, 0)

**Visible → Exit**

- Triggered when toast removed from active list
- Toast stays mounted during exit
- Opacity: 1 → 0
- Transform: translate3d(0, 0, 0) → offset
- Pointer events disabled

**Exit → Unmount**

- After `TRANSITION_DURATION_MS` (180ms)
- Toast removed from DOM
- Exit timer cleaned up

### State Management

**RenderedToast**

```typescript
interface RenderedToast {
  toast: ToastRecord;
  phase: ToastRenderPhase;
}
```

The provider maintains `renderedToasts` state separate from core manager state to control lifecycle timing.

**Synchronization Logic**

- When core state updates, provider reconciles rendered list
- Existing toasts update their data but preserve phase
- New toasts enter with `enter` phase
- Removed toasts transition to `exit` phase
- Exiting toasts unmount after transition duration

## Interaction Wiring

### Hover Pause/Resume

```typescript
onMouseEnter={() => manager.pause(toast.id)}
onMouseLeave={() => manager.resume(toast.id)}
```

Pausing:

- Stops countdown timer
- Preserves remaining time
- Prevents auto-dismiss while hovering

Resuming:

- Restarts countdown with remaining time
- Continues toward auto-dismiss

### Click Dismiss

```typescript
onClick={toast.dismissOnClick ? dismiss : undefined}
```

Conditional based on `dismissOnClick` option (default: true).

## Accessibility

### ARIA Attributes

**role**

- `status` (default) - Polite announcements
- `alert` - Assertive announcements

**aria-live**

- Derived from role
- `polite` for status
- `assertive` for alert

### Data Attributes

Every toast wrapper includes:

```html
<div
  data-twist-toast=""
  data-position="top-right"
  data-variant="success"
  data-state="active"
  role="status"
  aria-live="polite"
></div>
```

**data-state values**:

- `entering` - Enter phase
- `active` - Visible and not paused
- `paused` - Visible but paused
- `exiting` - Exit phase

These attributes enable custom styling without library-imposed CSS.

## Registry Pattern

The registry enables zero-config provider setup by tracking all toast instances globally.

### Registry Structure

```typescript
interface ToastRegistryEntry {
  id: string;
  manager: ToastManager;
  components: ToastComponentsMap;
}
```

### Internal State

- `instanceIds: WeakMap<object, string>` - Maps instance to generated ID
- `entries: Map<string, ToastRegistryEntry>` - Stores registry entries
- `listeners: Set<RegistryListener>` - Subscription listeners
- `snapshot: ToastRegistryEntry[]` - Cached array for `useSyncExternalStore`

### API

**registerInstance(instance, manager, components)**

Called by `createToast()` to register new instance.

**getInstancesSnapshot()**

Returns current snapshot array for `useSyncExternalStore`.

**subscribeToRegistry(listener)**

Subscribes to registry changes, returns unsubscribe function.

### Why This Design

- Provider requires no props or configuration
- Supports multiple isolated toast instances
- Avoids context prop-drilling
- Compatible with `useSyncExternalStore` for concurrent React

## Styling

### No Built-in CSS

The package ships zero CSS. You own all visual styling.

### Styling Approaches

**1. Data Attribute Selectors**

```css
[data-twist-toast] {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 1rem;
}

[data-state="entering"],
[data-state="exiting"] {
  /* Transition styles already applied inline */
}

[data-variant="success"] {
  border-left: 4px solid green;
}

[data-variant="error"] {
  border-left: 4px solid red;
}
```

**2. Component-Level Styles**

Style your toast components directly:

```typescript
function SuccessToast({ message, dismiss }: ToastComponentProps<{ message: string }>) {
  return (
    <div className="success-toast">
      <CheckIcon />
      <p>{message}</p>
      <button onClick={dismiss}>×</button>
    </div>
  )
}
```

**3. CSS-in-JS / Tailwind**

Use any styling solution within your components.

### Inline Transition Styles

The provider applies inline styles for transitions:

```typescript
{
  pointerEvents: phase === 'exit' ? 'none' : 'auto',
  opacity: isVisible ? 1 : 0,
  transform: isVisible ? 'translate3d(0, 0, 0)' : getHiddenTransform(position),
  transition: `opacity 180ms ease, transform 180ms ease`,
  willChange: 'opacity, transform',
}
```

These ensure smooth enter/exit animations without requiring CSS files.

## Testing

### Test Setup

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { createToast, ToastProvider } from "@twist-toast/react";
import { vi } from "vitest";
```

### Test Utilities

**Fake Timers**

Required for testing lifecycle timing:

```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

**Advancing Time**

```typescript
// Advance past transition duration
vi.advanceTimersByTime(200);
```

### Example Test

```typescript
test('renders and dismisses toast', async () => {
  const toast = createToast({
    info: ({ message, dismiss }) => (
      <div>
        <p>{message}</p>
        <button onClick={dismiss}>Close</button>
      </div>
    ),
  })

  render(
    <ToastProvider>
      <button onClick={() => toast.info({ message: 'Hello' })}>
        Show Toast
      </button>
    </ToastProvider>
  )

  // Trigger toast
  fireEvent.click(screen.getByText('Show Toast'))

  // Wait for enter phase
  vi.advanceTimersByTime(50)

  expect(screen.getByText('Hello')).toBeInTheDocument()

  // Dismiss
  fireEvent.click(screen.getByText('Close'))

  // Advance past exit transition
  vi.advanceTimersByTime(200)

  await waitFor(() => {
    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
  })
})
```

## Build Configuration

### tsdown.config.ts

```typescript
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
});
```

### Output Structure

```
dist/
├── index.js      # ESM bundle
└── index.d.ts    # Type declarations
```

## Usage Example

### 1. Define Components

```typescript
// components/toasts.tsx
import type { ToastComponentProps } from '@twist-toast/react'

export function SuccessToast({
  message,
  dismiss
}: ToastComponentProps<{ message: string }>) {
  return (
    <div className="toast toast-success">
      <p>{message}</p>
      <button onClick={dismiss}>×</button>
    </div>
  )
}

export function ErrorToast({
  message,
  action,
  dismiss
}: ToastComponentProps<{ message: string; action?: () => void }>) {
  return (
    <div className="toast toast-error">
      <p>{message}</p>
      {action && <button onClick={action}>Retry</button>}
      <button onClick={dismiss}>×</button>
    </div>
  )
}
```

### 2. Create Toast Instance

```typescript
// lib/toast.ts
import { createToast } from "@twist-toast/react";
import { SuccessToast, ErrorToast } from "@/components/toasts";

export const toast = createToast(
  {
    success: SuccessToast,
    error: ErrorToast,
  },
  {
    defaultDuration: 5000,
    defaultPosition: "top-right",
    maxToasts: 3,
  },
);
```

### 3. Mount Provider

```typescript
// App.tsx
import { ToastProvider } from '@twist-toast/react'

export function App() {
  return (
    <ToastProvider>
      <YourApp />
    </ToastProvider>
  )
}
```

### 4. Use Anywhere

```typescript
// Any component
import { toast } from '@/lib/toast'

function MyComponent() {
  const handleSuccess = () => {
    toast.success({ message: 'Saved successfully!' })
  }

  const handleError = () => {
    toast.error({
      message: 'Failed to save',
      action: () => console.log('Retry clicked')
    })
  }

  return (
    <>
      <button onClick={handleSuccess}>Save</button>
      <button onClick={handleError}>Fail</button>
    </>
  )
}
```

## Key Design Decisions

### Why Factory Pattern

- Enables full type inference from component map
- No context hooks needed for firing toasts
- Stable imports across application
- Supports multiple isolated instances

### Why Global Registry

- Zero-config provider setup
- No prop-drilling of managers or components
- Automatic discovery of all instances
- Compatible with React 18 concurrent features

### Why Portal Rendering

- Avoids z-index and overflow issues
- Predictable layering above app content
- Independent from app layout constraints

### Why Separate Lifecycle State

- Core remains UI-agnostic
- Transition timing is presentation concern
- Different adapters can implement different strategies
- No API expansion needed in core

### Why No Built-in CSS

- Preserves design system flexibility
- Reduces bundle size
- Avoids specificity conflicts
- Aligns with headless UI philosophy

## Comparison with Core

| Concern          | Core Package | React Package |
| ---------------- | ------------ | ------------- |
| State management | ✅           | Consumes      |
| Queue logic      | ✅           | Consumes      |
| Timers           | ✅           | Consumes      |
| Pause/resume     | ✅           | Wires events  |
| Rendering        | ❌           | ✅            |
| Transitions      | ❌           | ✅            |
| Type inference   | ❌           | ✅            |
| Factory API      | ❌           | ✅            |
| Provider         | ❌           | ✅            |

## Future Considerations

Potential enhancements without breaking architecture:

- Configurable transition duration/easing
- Reduced motion support (`prefers-reduced-motion`)
- Gesture dismiss (swipe)
- Stacking strategies (stack vs overlap)
- Custom portal target
- SSR hydration support

All can be added in React layer without core changes.
