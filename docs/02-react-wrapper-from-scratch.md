# React Wrapper From Scratch (`@twist-toast/react`)

## 1. Goal

Build a React adapter that converts core behavior into a good developer API and visible UI rendering.

Main responsibilities:

- typed `createToast()` API from user component map
- provider-based rendering in a portal
- event wiring (`pause`, `resume`, `dismiss`)
- accessibility attributes
- no default CSS opinions

## 2. Type System Strategy

Defined in `packages/react/src/types.ts`.

Core idea:

- user supplies variant components map
- each component receives `dismiss` and `toastId`
- payload params for `toast.success(payload)` are inferred from component props

Important type utilities:

- `ExtractPayload<TComponent>`
- `RequiredKeys<T>`
- `VariantMethod<TComponent>`

Result:

- required payload props stay required
- optional payload props become optional
- `dismiss` and `toastId` are injected by library, not provided by consumer

## 3. `createToast()` Factory Flow

Implemented in `packages/react/src/create-toast.ts`.

Step-by-step:

1. Build core manager options from React options (`maxToasts`, `dedupe`, `now`, `generateId`).
2. Create manager via `createToastManager`.
3. Resolve defaults:
   - duration (4000)
   - position (`top-right`)
   - dismiss on click (`true`)
   - role (`status`)
4. Loop through component map variants and generate methods.
5. Each generated method:
   - merges call options with defaults
   - normalizes payload into object via `toPayload`
   - builds `ToastInput`
   - calls `manager.add()`
6. Add shared controls: `dismiss(id)` and `dismissAll()`.
7. Register instance into registry so provider can render it.

Why this design:

- no context hook needed for firing toasts
- methods are stable and easy to import globally
- strong type inference with low runtime complexity

## 4. Instance Registry Pattern

Implemented in `packages/react/src/registry.ts`.

Registry role:

- track all toast instances created by `createToast`
- expose snapshot + subscription API for provider

Key structures:

- `WeakMap` instance -> generated id
- `Map` id -> `{ manager, components }`
- cached `snapshot` array for `useSyncExternalStore`

Why this matters:

- provider stays zero-config
- supports multiple isolated toast instances
- avoids prop-drilling managers/components

## 5. `ToastProvider` Rendering Flow

Implemented in `packages/react/src/ToastProvider.tsx`.

Base flow:

1. Create a root portal node in `document.body` on mount.
2. Subscribe to registry using `useSyncExternalStore`.
3. Render one `ManagerToasts` per registered toast instance.
4. Inside each manager view:
   - subscribe to manager state
   - group active toasts by `position`
   - resolve variant component from component map
   - render toast wrapper and inject props

Why portal rendering:

- avoids stacking and overflow issues from app layout containers
- keeps toast layering predictable

## 6. Interaction Wiring

Per toast wrapper:

- `onMouseEnter` -> `manager.pause(toast.id)`
- `onMouseLeave` -> `manager.resume(toast.id)`
- `onClick` -> conditional `dismiss` if `dismissOnClick` is true

Accessibility wiring:

- `role` is provided by toast record (`status` or `alert`)
- `aria-live` derives from role (`polite` or `assertive`)

Styling hooks:

- `data-twist-toast`
- `data-position`
- `data-variant`
- `data-state`

No CSS file is bundled, so consumers fully own visuals.

## 7. What Was Considered

DX considerations:

- keep setup minimal: define components, call `createToast`, mount provider
- preserve type-safe variant methods without manual typing

Performance considerations:

- core subscriptions are localized per manager
- registry uses snapshot model for stable subscription behavior
- no heavy runtime dependency for animation/state machines

Maintainability considerations:

- core and React concerns are separated
- provider logic is concentrated in one file
- test hooks (`now`, `generateId`) keep behavior deterministic

## 8. Test Coverage in React Layer

`packages/react/tests/toast-react.test.tsx` validates:

- provider renders a toast after trigger
- toast content appears
- dismiss interaction removes toast from DOM

This is intentionally smoke-level for v1 while core behavior is tested in depth.

## 9. Rebuild Checklist

If you rebuild React adapter from zero:

1. Build inference types first.
2. Implement `createToast` method generation.
3. Add registry for created instances.
4. Implement provider and portal mount.
5. Render by position and inject `dismiss` + `toastId`.
6. Wire hover pause/resume and click dismiss.
7. Add accessibility attributes.
8. Add smoke tests with jsdom.
