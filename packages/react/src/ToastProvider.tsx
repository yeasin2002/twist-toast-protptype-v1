import type {
  ToastManager,
  ToastPosition,
  ToastRecord,
  ToastRole,
  ToastState,
} from "@twist-toast/core";
import type { CSSProperties, ReactNode } from "react";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { ToastErrorBoundary } from "./ToastErrorBoundary";
import { getInstancesSnapshot, subscribeToRegistry } from "./registry";
import type { ToastComponent, ToastComponentsMap } from "./types";

interface ToastProviderProps {
  children: ReactNode;
}

const rootStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: 9999,
};

const positionStyles: Record<ToastPosition, CSSProperties> = {
  "top-left": {
    top: 0,
    left: 0,
    alignItems: "flex-start",
    flexDirection: "column",
  },
  "top-center": {
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
    alignItems: "center",
    flexDirection: "column",
  },
  "top-right": {
    top: 0,
    right: 0,
    alignItems: "flex-end",
    flexDirection: "column",
  },
  "bottom-left": {
    bottom: 0,
    left: 0,
    alignItems: "flex-start",
    flexDirection: "column-reverse",
  },
  "bottom-center": {
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    alignItems: "center",
    flexDirection: "column-reverse",
  },
  "bottom-right": {
    bottom: 0,
    right: 0,
    alignItems: "flex-end",
    flexDirection: "column-reverse",
  },
};

/**
 * Check if user prefers reduced motion
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const TRANSITION_DURATION_MS = prefersReducedMotion() ? 0 : 180;

type ToastRenderPhase = "enter" | "visible" | "exit";

interface RenderedToast {
  toast: ToastRecord;
  phase: ToastRenderPhase;
}

function getAriaLive(role: ToastRole): "polite" | "assertive" {
  return role === "alert" ? "assertive" : "polite";
}

function getPositionBuckets(
  toasts: RenderedToast[],
): Map<ToastPosition, RenderedToast[]> {
  const buckets = new Map<ToastPosition, RenderedToast[]>();

  for (const item of toasts) {
    const position = item.toast.position;
    const current = buckets.get(position);
    if (current) {
      current.push(item);
      continue;
    }

    buckets.set(position, [item]);
  }

  return buckets;
}

function getHiddenTransform(position: ToastPosition): string {
  switch (position) {
    case "top-left":
      return "translate3d(-8px, -8px, 0)";
    case "top-center":
      return "translate3d(0, -8px, 0)";
    case "top-right":
      return "translate3d(8px, -8px, 0)";
    case "bottom-left":
      return "translate3d(-8px, 8px, 0)";
    case "bottom-center":
      return "translate3d(0, 8px, 0)";
    case "bottom-right":
      return "translate3d(8px, 8px, 0)";
  }
}

function getToastStyle(
  position: ToastPosition,
  phase: ToastRenderPhase,
  reducedMotion: boolean,
): CSSProperties {
  const isVisible = phase === "visible";

  if (reducedMotion) {
    // Skip transitions for reduced motion
    return {
      pointerEvents: phase === "exit" ? "none" : "auto",
      opacity: isVisible ? 1 : 0,
    };
  }

  return {
    pointerEvents: phase === "exit" ? "none" : "auto",
    opacity: isVisible ? 1 : 0,
    transform: isVisible
      ? "translate3d(0, 0, 0)"
      : getHiddenTransform(position),
    transition: `opacity ${TRANSITION_DURATION_MS}ms ease, transform ${TRANSITION_DURATION_MS}ms ease`,
    willChange: "opacity, transform",
  };
}

/**
 * Error boundary to catch toast component errors
 */
class ToastErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error("Toast render error:", error, errorInfo);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

interface ManagerToastsProps {
  manager: ToastManager;
  components: ToastComponentsMap;
}

function ManagerToasts({ manager, components }: ManagerToastsProps) {
  const [renderedToasts, setRenderedToasts] = useState<RenderedToast[]>([]);
  const exitTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const reducedMotion = prefersReducedMotion();

  // Subscribe to manager and reconcile in one effect
  useEffect(() => {
    return manager.subscribe((state) => {
      const activeById = new Map(
        state.active.map((toast) => [toast.id, toast]),
      );

      setRenderedToasts((previous) => {
        const next: RenderedToast[] = [];
        const seen = new Set<string>();

        // Update existing toasts
        for (const item of previous) {
          const activeToast = activeById.get(item.toast.id);
          if (activeToast) {
            next.push({
              toast: activeToast,
              phase: item.phase === "exit" ? "visible" : item.phase,
            });
          } else {
            next.push({
              toast: item.toast,
              phase: "exit",
            });
          }
          seen.add(item.toast.id);
        }

        // Add new toasts
        for (const toast of state.active) {
          if (seen.has(toast.id)) {
            continue;
          }
          next.push({
            toast,
            phase: "enter",
          });
        }

        return next;
      });
    });
  }, [manager]);

  // Transition enter -> visible
  useEffect(() => {
    const hasEnteringToasts = renderedToasts.some(
      (item) => item.phase === "enter",
    );
    if (!hasEnteringToasts) {
      return undefined;
    }

    const frame = requestAnimationFrame(() => {
      setRenderedToasts((previous) =>
        previous.map((item) =>
          item.phase === "enter"
            ? {
                ...item,
                phase: "visible",
              }
            : item,
        ),
      );
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [renderedToasts]);

  // Handle exit timers
  useEffect(() => {
    const exitingIds = new Set(
      renderedToasts
        .filter((item) => item.phase === "exit")
        .map((item) => item.toast.id),
    );

    for (const id of exitingIds) {
      if (exitTimers.current.has(id)) {
        continue;
      }

      const handle = setTimeout(() => {
        exitTimers.current.delete(id);
        setRenderedToasts((previous) =>
          previous.filter((item) => item.toast.id !== id),
        );
      }, TRANSITION_DURATION_MS);

      exitTimers.current.set(id, handle);
    }

    for (const [id, handle] of Array.from(exitTimers.current.entries())) {
      if (exitingIds.has(id)) {
        continue;
      }

      clearTimeout(handle);
      exitTimers.current.delete(id);
    }
  }, [renderedToasts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const handle of exitTimers.current.values()) {
        clearTimeout(handle);
      }
      exitTimers.current.clear();
    };
  }, []);

  const groupedToasts = useMemo(
    () => getPositionBuckets(renderedToasts),
    [renderedToasts],
  );

  return (
    <>
      {Array.from(groupedToasts.entries()).map(([position, toasts]) => {
        const containerStyle: CSSProperties = {
          position: "absolute",
          display: "flex",
          gap: "0.5rem",
          maxWidth: "min(420px, calc(100vw - 1rem))",
          padding: "0.5rem",
          pointerEvents: "none",
          ...positionStyles[position],
        };

        return (
          <div key={position} data-position={position} style={containerStyle}>
            {toasts.map((item) => {
              const toast = item.toast;
              const ToastView = components[toast.variant] as
                | ToastComponent
                | undefined;

              if (!ToastView) {
                return null;
              }

              const dismiss = () => {
                manager.dismiss(toast.id);
              };

              const handleMouseEnter = () => {
                manager.pause(toast.id);
              };

              const handleMouseLeave = () => {
                manager.resume(toast.id);
              };

              const handleKeyDown = (e: React.KeyboardEvent) => {
                if (e.key === "Escape") {
                  dismiss();
                }
              };

              const visualState =
                item.phase === "exit"
                  ? "exiting"
                  : item.phase === "enter"
                    ? "entering"
                    : toast.paused
                      ? "paused"
                      : "active";

              return (
                <ToastErrorBoundary key={toast.id} onError={dismiss}>
                  <div
                    data-twist-toast=""
                    data-position={toast.position}
                    data-variant={toast.variant}
                    data-state={visualState}
                    role={toast.role}
                    aria-live={getAriaLive(toast.role)}
                    tabIndex={0}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onClick={toast.dismissOnClick ? dismiss : undefined}
                    onKeyDown={handleKeyDown}
                    style={getToastStyle(
                      toast.position,
                      item.phase,
                      reducedMotion,
                    )}
                  >
                    <ToastView
                      {...toast.payload}
                      dismiss={dismiss}
                      toastId={toast.id}
                    />
                  </div>
                </ToastErrorBoundary>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const instances = useSyncExternalStore(
    subscribeToRegistry,
    getInstancesSnapshot,
    getInstancesSnapshot,
  );

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const root = document.createElement("div");
    root.setAttribute("data-twist-toast-root", "");
    Object.assign(root.style, rootStyle);

    document.body.appendChild(root);
    setPortalRoot(root);

    return () => {
      root.remove();
    };
  }, []);

  return (
    <>
      {children}
      {portalRoot
        ? createPortal(
            <>
              {instances.map((entry) => (
                <ManagerToasts
                  key={entry.id}
                  manager={entry.manager}
                  components={entry.components}
                />
              ))}
            </>,
            portalRoot,
          )
        : null}
    </>
  );
}
