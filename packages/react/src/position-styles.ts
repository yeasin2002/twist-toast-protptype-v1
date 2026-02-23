import type { CSSProperties } from "react";
import type { ToastPosition } from "@twist-toast/core";

export const TOAST_POSITIONS: ToastPosition[] = [
  "top-right",
  "top-left",
  "bottom-right",
  "bottom-left",
  "top-center",
  "bottom-center",
];

const EDGE_OFFSET = 16;

export const TOAST_VIEWPORT_BASE_STYLE: CSSProperties = {
  position: "fixed",
  zIndex: 9999,
  display: "flex",
  gap: 8,
  pointerEvents: "none",
  width: "min(420px, calc(100vw - 32px))",
};

export const TOAST_WRAPPER_STYLE: CSSProperties = {
  pointerEvents: "auto",
  width: "100%",
};

export function getViewportStyle(position: ToastPosition): CSSProperties {
  switch (position) {
    case "top-right":
      return {
        ...TOAST_VIEWPORT_BASE_STYLE,
        top: EDGE_OFFSET,
        right: EDGE_OFFSET,
        alignItems: "stretch",
        flexDirection: "column",
      };
    case "top-left":
      return {
        ...TOAST_VIEWPORT_BASE_STYLE,
        top: EDGE_OFFSET,
        left: EDGE_OFFSET,
        alignItems: "stretch",
        flexDirection: "column",
      };
    case "bottom-right":
      return {
        ...TOAST_VIEWPORT_BASE_STYLE,
        bottom: EDGE_OFFSET,
        right: EDGE_OFFSET,
        alignItems: "stretch",
        flexDirection: "column-reverse",
      };
    case "bottom-left":
      return {
        ...TOAST_VIEWPORT_BASE_STYLE,
        bottom: EDGE_OFFSET,
        left: EDGE_OFFSET,
        alignItems: "stretch",
        flexDirection: "column-reverse",
      };
    case "top-center":
      return {
        ...TOAST_VIEWPORT_BASE_STYLE,
        top: EDGE_OFFSET,
        left: "50%",
        transform: "translateX(-50%)",
        alignItems: "stretch",
        flexDirection: "column",
      };
    case "bottom-center":
      return {
        ...TOAST_VIEWPORT_BASE_STYLE,
        bottom: EDGE_OFFSET,
        left: "50%",
        transform: "translateX(-50%)",
        alignItems: "stretch",
        flexDirection: "column-reverse",
      };
    default:
      return TOAST_VIEWPORT_BASE_STYLE;
  }
}
