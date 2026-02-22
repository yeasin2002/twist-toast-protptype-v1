# @twist-toast/react

React adapter package for the twist-toast project.

This package provides the React-facing API on top of `@twist-toast/core`.
The public API remains stable while internals stay intentionally small:
registry-backed zero-config provider wiring, minimal lifecycle reconciliation,
and built-in fade/slide enter-exit transitions.

## Scope

- React-only code
- UI integration layer for the core package
- Should not duplicate framework-agnostic business logic from `@twist-toast/core`

## What It Provides

- `createToast(components, options?)`
- Typed toast instance methods from your component map
- Zero-config `<ToastProvider>` for rendering
- Pause-on-hover and click-to-dismiss behavior wiring
- Escape-key dismissal and reduced-motion-aware transitions

## Usage

```tsx
import { ToastProvider, createToast } from "@twist-toast/react";
import type { ToastComponentProps } from "@twist-toast/react";

const toast = createToast({
  success: ({ title }: ToastComponentProps<{ title: string }>) => (
    <div>{title}</div>
  ),
});
```

```tsx
function App() {
  return (
    <ToastProvider>
      <button onClick={() => toast.success({ title: "Saved!" })}>
        Trigger
      </button>
    </ToastProvider>
  );
}
```

## Peer Dependencies

- `react`
- `react-dom`

## Build

From repository root:

```bash
pnpm --filter @twist-toast/react build
```

Watch mode:

```bash
pnpm --filter @twist-toast/react dev
```

## Test

```bash
pnpm --filter @twist-toast/react test
```
