import type { ToastPosition } from "@twist-toast/core";
import type { RenderedToast } from "../types";

export function groupToastsByPosition(
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
