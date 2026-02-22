import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

interface ToastErrorBoundaryProps {
  children: ReactNode;
  onError: (error: Error) => void;
}

interface ToastErrorBoundaryState {
  hasError: boolean;
}

/**
 * Error boundary that catches errors in toast components.
 *
 * Prevents toast component errors from crashing the entire app.
 * When an error occurs, the toast is automatically dismissed.
 *
 * Note: Error boundaries must be class components in React.
 * There is no functional component equivalent for componentDidCatch.
 */
export class ToastErrorBoundary extends Component<
  ToastErrorBoundaryProps,
  ToastErrorBoundaryState
> {
  constructor(props: ToastErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ToastErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error for debugging (bundler will tree-shake in production)
    console.error("[twist-toast] Toast component error:", error, errorInfo);

    // Notify parent to dismiss the broken toast
    this.props.onError(error);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      // Don't render anything if there's an error
      return null;
    }

    return this.props.children;
  }
}
