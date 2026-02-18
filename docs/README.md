# twist-toast Implementation Docs

This folder documents how the current v1 implementation was built and why each design choice was made.

Use this reading order:

1. `docs/01-core-manager-from-scratch.md`
2. `docs/02-react-wrapper-from-scratch.md`
3. `docs/03-transition-animation-fix.md`

## Source Map

Core engine:

- `packages/core/src/types.ts`
- `packages/core/src/toast-manager.ts`
- `packages/core/tests/toast-manager.test.ts`

React adapter:

- `packages/react/src/types.ts`
- `packages/react/src/create-toast.ts`
- `packages/react/src/registry.ts`
- `packages/react/src/ToastProvider.tsx`
- `packages/react/tests/toast-react.test.tsx`

Example usage:

- `examples/vite-react/src/lib/toast.ts`
- `examples/vite-react/src/App.tsx`
