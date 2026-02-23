# @twist-toast/core

Framework-agnostic toast state engine for the twist-toast project.

This package contains pure toast behavior with no UI framework dependency.
It is designed to be consumed by adapter packages such as `@twist-toast/react`.
The internals are intentionally minimal: ordered state (`order + byId`) and a
single timer-sync pass that keeps active toast timers in sync with queue state.

## What It Provides

- `createToastManager(options?)`
- Queueing with `maxToasts`
- Dedupe behavior (`ignore` or `refresh`)
- Pause/resume timer controls
- Deterministic timer sync for active toasts
- Subscription-based state updates
- Type-safe toast state and input contracts

## Usage

```ts
import { createToastManager } from "@twist-toast/core";

const manager = createToastManager({ maxToasts: 5 });

const id = manager.add({
  variant: "info",
  payload: { message: "Saved" },
  duration: 3000,
  position: "top-right",
  dismissOnClick: true,
  role: "status",
});

manager.pause(id);
manager.resume(id);
manager.dismiss(id);
```

## Build

From repository root:

```bash
pnpm --filter @twist-toast/core build
```

Watch mode:

```bash
pnpm --filter @twist-toast/core dev
```

## Test

```bash
pnpm --filter @twist-toast/core test
```
