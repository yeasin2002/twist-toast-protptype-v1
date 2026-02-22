import type {
  ToastManager,
  ToastPosition,
  ToastRecord,
  ToastRole,
} from "@twist-toast/core";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import {
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

const TRANSITION_DURATION_MS = 180;

const rootStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: 9999,
};

const baseContainerStyle: CSSProperties = {
  position: "absolute",
  display: "flex",
  gap: "0.5rem",
  maxWidth: "min(420px, calc(100vw - 1rem))",
  padding: "0.5rem",
  pointerEvents: "none",
};

const containerStyles: Record<ToastPosition, CSSProperties> = {
  "top-left": {
    ...baseContainerStyle,
    top: 0,
    left: 0,
    alignItems: "flex-start",
    flexDirection: "column",
  },
  "top-center": {
    ...baseContainerStyle,
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
    alignItems: "center",
    flexDirection: "column",
  },
  "top-right": {
    ...baseContainerStyle,
    top: 0,
    right: 0,
    alignItems: "flex-end",
    flexDirection: "column",
  },
  "bottom-left": {
    ...baseContainerStyle,
    bottom: 0,
    left: 0,
    alignItems: "flex-start",
    flexDirection: "column-reverse",
  },
  "bottom-center": {
    ...baseContainerStyle,
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    alignItems: "center",
    flexDirection: "column-reverse",
  },
  "bottom-right": {
    ...baseContainerStyle,
    bottom: 0,
    right: 0,
    alignItems: "flex-end",
    flexDirection: "column-reverse",
  },
};

type ToastRenderPhase = "enter" | "visible" | "exit";

interface RenderedToast {
  toast: ToastRecord;
  phase: ToastRenderPhase;
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    update();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => {
        mediaQuery.removeEventListener("change", update);
      };
    }

    mediaQuery.addListener(update);
    return () => {
      mediaQuery.removeListener(update);
    };
  }, []);

  return prefersReducedMotion;
}

function getAriaLive(role: ToastRole): "polite" | "assertive" {
  return role === "alert" ? "assertive" : "polite";
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
  transitionDuration: number,
): CSSProperties {
  const isVisible = phase === "visible";
  const baseStyle: CSSProperties = {
    pointerEvents: phase === "exit" ? "none" : "auto",
    opacity: isVisible ? 1 : 0,
  };

  if (transitionDuration <= 0) {
    return baseStyle;
  }

  return {
    ...baseStyle,
    transform: isVisible
      ? "translate3d(0, 0, 0)"
      : getHiddenTransform(position),
    transition: `opacity ${transitionDuration}ms ease, transform ${transitionDuration}ms ease`,
    willChange: "opacity, transform",
  };
}

function getVisualState(
  phase: ToastRenderPhase,
  paused: boolean,
): "active" | "paused" | "entering" | "exiting" {
  if (phase === "exit") {
    return "exiting";
  }
  if (phase === "enter") {
    return "entering";
  }
  if (paused) {
    return "paused";
  }
  return "active";
}

function reconcileRenderedToasts(
  previous: RenderedToast[],
  activeToasts: readonly ToastRecord[],
): RenderedToast[] {
  const activeById = new Map(activeToasts.map((toast) => [toast.id, toast]));
  const seen = new Set<string>();
  const next: RenderedToast[] = [];

  for (const item of previous) {
    const activeToast = activeById.get(item.toast.id);
    if (activeToast) {
      next.push({
        toast: activeToast,
        phase: item.phase === "exit" ? "visible" : item.phase,
      });
    } else {
      next.push(
        item.phase === "exit"
          ? item
          : {
              toast: item.toast,
              phase: "exit",
            },
      );
    }
    seen.add(item.toast.id);
  }

  for (const toast of activeToasts) {
    if (!seen.has(toast.id)) {
      next.push({
        toast,
        phase: "enter",
      });
    }
  }

  return next;
}

function markEnteringToastsVisible(toasts: RenderedToast[]): RenderedToast[] {
  let changed = false;
  const next = toasts.map<RenderedToast>((item) => {
    if (item.phase !== "enter") {
      return item;
    }
    changed = true;
    return {
      ...item,
      phase: "visible",
    };
  });

  return changed ? next : toasts;
}

function groupToastsByPosition(
  toasts: RenderedToast[],
): Map<ToastPosition, RenderedToast[]> {
  const groups = new Map<ToastPosition, RenderedToast[]>();

  for (const item of toasts) {
    const position = item.toast.position;
    const current = groups.get(position);
    if (current) {
      current.push(item);
      continue;
    }
    groups.set(position, [item]);
  }

  return groups;
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
  const prefersReducedMotion = usePrefersReducedMotion();
  const transitionDuration = prefersReducedMotion ? 0 : TRANSITION_DURATION_MS;

  useEffect(() => {
    return manager.subscribe((state) => {
      setRenderedToasts((previous) =>
        reconcileRenderedToasts(previous, state.active),
      );
    });
  }, [manager]);

  useEffect(() => {
    const hasEnteringToasts = renderedToasts.some(
      (item) => item.phase === "enter",
    );
    if (!hasEnteringToasts) {
      return undefined;
    }

    if (transitionDuration === 0) {
      setRenderedToasts((previous) => markEnteringToastsVisible(previous));
      return undefined;
    }

    const frame = requestAnimationFrame(() => {
      setRenderedToasts((previous) => markEnteringToastsVisible(previous));
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [renderedToasts, transitionDuration]);

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
      }, transitionDuration);

      exitTimers.current.set(id, handle);
    }

    for (const [id, handle] of Array.from(exitTimers.current.entries())) {
      if (exitingIds.has(id)) {
        continue;
      }
      clearTimeout(handle);
      exitTimers.current.delete(id);
    }
  }, [renderedToasts, transitionDuration]);

  useEffect(() => {
    return () => {
      for (const handle of exitTimers.current.values()) {
        clearTimeout(handle);
      }
      exitTimers.current.clear();
    };
  }, []);

  const groupedToasts = useMemo(
    () => groupToastsByPosition(renderedToasts),
    [renderedToasts],
  );

  return (
    <>
      {Array.from(groupedToasts.entries()).map(([position, toasts]) => (
        <div
          key={position}
          data-position={position}
          style={containerStyles[position]}
        >
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

            const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
              if (event.key === "Escape") {
                dismiss();
              }
            };

            return (
              <ToastErrorBoundary key={toast.id} onError={dismiss}>
                <div
                  data-twist-toast=""
                  data-position={toast.position}
                  data-variant={toast.variant}
                  data-state={getVisualState(item.phase, toast.paused)}
                  role={toast.role}
                  aria-live={getAriaLive(toast.role)}
                  tabIndex={0}
                  onMouseEnter={() => manager.pause(toast.id)}
                  onMouseLeave={() => manager.resume(toast.id)}
                  onClick={toast.dismissOnClick ? dismiss : undefined}
                  onKeyDown={handleKeyDown}
                  style={getToastStyle(
                    toast.position,
                    item.phase,
                    transitionDuration,
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
      ))}
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
