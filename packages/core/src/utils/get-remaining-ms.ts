import { ToastRecord } from "../types";

export function getRemainingMs(
  toast: ToastRecord,
  currentTime: number,
): number {
  if (toast.paused && toast.pausedAt !== undefined) {
    const elapsed = toast.pausedAt - toast.createdAt - toast.totalPausedMs;
    return Math.max(0, toast.duration - elapsed);
  }
  const elapsed = currentTime - toast.createdAt - toast.totalPausedMs;
  return Math.max(0, toast.duration - elapsed);
}
