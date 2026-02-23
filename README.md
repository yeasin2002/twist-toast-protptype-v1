# twist-toast

`twist-toast` is a design-system-first toast library.

- You own toast UI and styles.
- The library handles queueing, timers, dedupe, dismissal, accessibility defaults, and typed APIs.
- Runtime dependency surface is minimal: React peer deps only in the React adapter.

## Packages

- `@twist-toast/core`: framework-agnostic toast state manager.
- `@twist-toast/react`: React `createToast()` factory + `ToastProvider`.

## Quick Start

```tsx
import {
  createToast,
  ToastProvider,
  type ToastComponentProps,
} from "@twist-toast/react";

type SuccessPayload = { title: string; description?: string };

function SuccessToast({
  title,
  description,
  dismiss,
}: ToastComponentProps<SuccessPayload>) {
  return (
    <div>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      <button onClick={dismiss}>Dismiss</button>
    </div>
  );
}

export const toast = createToast(
  { success: SuccessToast },
  {
    scope: "global",
    maxToasts: 5,
    defaultDuration: 4000,
    defaultPosition: "top-right",
  },
);

export function App({ children }: { children: React.ReactNode }) {
  return <ToastProvider scope="global">{children}</ToastProvider>;
}
```

Trigger:

```ts
toast.success({ title: "Saved" });
toast.success(
  { title: "Queued" },
  { id: "job-1", duration: 8000, role: "status" },
);
toast.dismiss("job-1");
toast.dismissAll();
```

## API Overview

`createToast(components, options?)`

- `components`: variant-to-component map.
- `options`: global defaults.
  - `defaultDuration` (default `4000`)
  - `defaultPosition` (default `"top-right"`)
  - `maxToasts` (default `5`)
  - `dedupe` (`"refresh"` default, or `"ignore"`)
  - `scope` (default `"default"`)

Per-call options (`toast.variant(payload, options?)`):

- `id`
- `duration`
- `position`
- `dismissOnClick`
- `role` (`"alert"` or `"status"`)

## Scope and Isolation

- Each `createToast` instance belongs to one `scope`.
- `<ToastProvider scope="...">` only renders instances from the same scope.
- One provider per scope is the supported path.

## Development

```bash
pnpm install
pnpm build
pnpm lint
pnpm check-types
pnpm format
```

Example app:

```bash
pnpm --filter vite-react dev
```
