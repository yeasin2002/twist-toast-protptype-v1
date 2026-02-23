type ToastRenderPhase = "enter" | "visible" | "exit";

import type { ToastPosition } from "@twist-toast/core";
import type { CSSProperties } from "react";

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

export function getToastStyle(
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
