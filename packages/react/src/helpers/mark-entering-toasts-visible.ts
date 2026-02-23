import type { RenderedToast } from "../types";

export function markEnteringToastsVisible(
  toasts: RenderedToast[],
): RenderedToast[] {
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
