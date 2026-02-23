import type { ToastPosition } from "@twist-toast/core";
import type { CSSProperties } from "react";

export const rootStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: 9999,
};

export const baseContainerStyle: CSSProperties = {
  position: "absolute",
  display: "flex",
  gap: "0.5rem",
  maxWidth: "min(420px, calc(100vw - 1rem))",
  padding: "0.5rem",
  pointerEvents: "none",
};

export const containerStyles: Record<ToastPosition, CSSProperties> = {
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
