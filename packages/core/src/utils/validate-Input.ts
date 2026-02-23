import { ToastInput, ToastPosition, ToastRole } from "../types";

export const VALID_ROLES: ToastRole[] = ["alert", "status"];
export const VALID_POSITIONS: ToastPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

export function validateInput(input: ToastInput): void {
  if (input.duration < 0) {
    throw new Error(
      `Invalid duration: ${input.duration}. Duration must be non-negative.`,
    );
  }
  if (!VALID_POSITIONS.includes(input.position)) {
    throw new Error(
      `Invalid position: ${input.position}. Must be one of: ${VALID_POSITIONS.join(", ")}`,
    );
  }
  if (!VALID_ROLES.includes(input.role)) {
    throw new Error(
      `Invalid role: ${input.role}. Must be one of: ${VALID_ROLES.join(", ")}`,
    );
  }
}
