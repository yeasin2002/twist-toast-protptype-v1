import { createToast } from "@twist-toast/react";
import { ErrorToast, InfoToast, SuccessToast } from "../toasts";

export const toast = createToast(
  {
    success: SuccessToast,
    error: ErrorToast,
    info: InfoToast,
  },
  {
    defaultDuration: 3500,
    defaultPosition: "top-right",
    maxToasts: 3,
  },
);
