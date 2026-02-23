import type { ToastRecord } from "@twist-toast/core";
type ToastRenderPhase = "enter" | "visible" | "exit";

interface RenderedToast {
  toast: ToastRecord;
  phase: ToastRenderPhase;
}

export function reconcileRenderedToasts(
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
