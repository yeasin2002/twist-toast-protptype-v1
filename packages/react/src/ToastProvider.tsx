import type { ToastManager, ToastRole } from "@twist-toast/core";
import type { RenderedToast } from "./types";

import type { KeyboardEvent, ReactNode } from "react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { ToastErrorBoundary } from "./ToastErrorBoundary";
import {
  containerStyles,
  getToastStyle,
  getVisualState,
  groupToastsByPosition,
  markEnteringToastsVisible,
  reconcileRenderedToasts,
  rootStyle,
} from "./helpers";
import { usePrefersReducedMotion } from "./hooks/use-refersreduced-motion";
import { getInstancesSnapshot, subscribeToRegistry } from "./registry";
import type { ToastComponent, ToastComponentsMap } from "./types";

interface ToastProviderProps {
  children: ReactNode;
}

const TRANSITION_DURATION_MS = 180;

function getAriaLive(role: ToastRole): "polite" | "assertive" {
  return role === "alert" ? "assertive" : "polite";
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
