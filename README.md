# twist-toast

A React toast notification library that gives you full design control while handling all the behavior.

## Why twist-toast?

Most toast libraries force you to override their styles to match your design system. twist-toast flips this: you own every pixel of the UI, and the library manages state, queuing, timing, and accessibility.

## Features

- 🎨 **Full Design Control** - Bring your own components, use your design tokens
- 🔒 **TypeScript-First** - Complete type inference from your component definitions
- 🪶 **Lightweight** - Zero runtime dependencies beyond React, <5KB gzipped
- ⚡ **Simple Integration** - Install → configure → use in under 5 minutes
- ♿ **Accessible** - WCAG 2.1 AA compliant with proper ARIA roles
- 🎯 **Smart Queuing** - Automatic queue management with deduplication
- 🔧 **Flexible** - Multiple isolated toast instances per app

## Installation

```bash
pnpm add twist-toast
# or
npm install twist-toast
# or
yarn add twist-toast
```

## Quick Start

### 1. Create your toast components

```tsx
// components/toasts.tsx
import type { ToastComponentProps } from 'twist-toast';

export const SuccessToast = ({ title, description, dismiss }: ToastComponentProps<{
  title: string;
  description?: string;
}>) => (
  <div className="success-toast" onClick={dismiss}>
    <strong>{title}</strong>
    {description && <p>{description}</p>}
  </div>
);

export const ErrorToast = ({ message, dismiss }: ToastComponentProps<{
  message: string;
}>) => (
  <div className="error-toast" onClick={dismiss}>
    <span>{message}</span>
  </div>
);
```

### 2. Configure your toast instance

```tsx
// lib/toast.ts
import { createToast } from 'twist-toast';
import { SuccessToast, ErrorToast } from '@/components/toasts';

export const toast = createToast(
  {
    success: SuccessToast,
    error: ErrorToast,
  },
  {
    defaultPosition: 'top-right',
    defaultDuration: 4000,
    maxToasts: 5,
  }
);
```

### 3. Add the provider to your app

```tsx
// app/layout.tsx
import { ToastProvider } from 'twist-toast';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
```

### 4. Use it anywhere

```tsx
import { toast } from '@/lib/toast';

function MyComponent() {
  const handleSave = async () => {
    try {
      await saveData();
      toast.success({ 
        title: 'Saved!', 
        description: 'Your changes were saved.' 
      });
    } catch (error) {
      toast.error({ message: 'Failed to save changes' });
    }
  };

  return <button onClick={handleSave}>Save</button>;
}
```

## API Reference

### `createToast(components, options?)`

Creates a typed toast instance bound to your component map.

**Parameters:**
- `components` - Object mapping variant names to React components
- `options` (optional) - Global configuration
  - `defaultPosition` - Default toast position (default: `'top-right'`)
  - `defaultDuration` - Default duration in ms (default: `4000`)
  - `maxToasts` - Maximum concurrent toasts (default: `5`)

**Returns:** Typed toast instance with methods for each variant

### Toast Instance Methods

```tsx
toast.success(payload, options?)
toast.error(payload, options?)
toast[variant](payload, options?)
toast.dismiss(id)
toast.dismissAll()
```

**Per-call options:**
- `duration` - Override default duration
- `position` - Override default position
- `dismissOnClick` - Enable/disable click to dismiss
- `id` - Custom toast ID (auto-generated if omitted)
- `role` - ARIA role (`'alert'` | `'status'`)

### `<ToastProvider>`

Zero-config context provider. Place once at your app root.

```tsx
<ToastProvider>
  {children}
</ToastProvider>
```

## Advanced Usage

### Multiple Toast Instances

Create isolated toast instances for different contexts:

```tsx
// Global toasts
export const toast = createToast({ success: GlobalSuccess, error: GlobalError });

// Modal-specific toasts
export const modalToast = createToast(
  { info: ModalInfo },
  { defaultPosition: 'bottom-center' }
);
```

### Programmatic Dismissal

```tsx
const toastId = toast.success({ title: 'Loading...' });

// Later...
toast.dismiss(toastId);
toast.success({ title: 'Complete!' });
```

### Custom Variants

```tsx
const toast = createToast({
  success: SuccessToast,
  error: ErrorToast,
  loading: LoadingToast,
  custom: CustomToast,
});

toast.loading({ message: 'Processing...' });
toast.custom({ data: 'anything' });
```

## Development

This is a monorepo managed with Turborepo and pnpm.

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Development mode
pnpm dev

# Run linting
pnpm lint

# Format code
pnpm format

# Type check
pnpm check-types
```

## Requirements

- React 17 or higher
- Node.js 18 or higher
- TypeScript 5.0+ (for TypeScript users)

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

For detailed requirements and architecture, see [PROJECT-BRD.md](./PROJECT-BRD.md).
