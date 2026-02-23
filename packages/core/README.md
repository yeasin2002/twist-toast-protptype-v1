# @twist-toast/core

Framework-agnostic toast manager used by adapter packages (React now, other frameworks later).

## What It Owns

- ordered queue + max visible window
- auto-dismiss timers
- duplicate id handling (`refresh` or `ignore`)
- `dismiss(id)` / `dismissAll()`
- pause/resume by toast position
- subscription API for UI adapters

## Public API

```ts
import { createToastManager } from "@twist-toast/core";

const manager = createToastManager({
  defaultDuration: 4000,
  defaultPosition: "top-right",
  maxToasts: 5,
  dedupe: "refresh",
  scope: "default",
});
```

Manager methods:

- `trigger(variant, payload, options?)`
- `dismiss(id)`
- `dismissAll()`
- `pauseByPosition(position)`
- `resumeByPosition(position)`
- `getSnapshot()`
- `subscribe(listener)`
- `destroy()`

## Build

```bash
pnpm --filter @twist-toast/core build
pnpm --filter @twist-toast/core check-types
```
