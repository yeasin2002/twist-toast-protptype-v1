type ToastRenderPhase = "enter" | "visible" | "exit";

export function getVisualState(
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
