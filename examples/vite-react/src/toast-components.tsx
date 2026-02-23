import type { ToastComponentProps } from "@twist-toast/react";

export type SuccessPayload = {
  title: string;
  description?: string;
};

export type ErrorPayload = {
  title: string;
  description: string;
  retryLabel?: string;
};

export type CustomPayload = {
  title: string;
  description?: string;
  accent?: string;
};

export type ModalPayload = {
  title: string;
  detail?: string;
};

export function SuccessToast({
  title,
  description,
  dismiss,
  toastId,
}: ToastComponentProps<SuccessPayload>) {
  return (
    <article className="toast-card toast-success">
      <div>
        <p className="toast-title">{title}</p>
        {description ? (
          <p className="toast-description">{description}</p>
        ) : null}
      </div>
      <button
        aria-label={`Dismiss toast ${toastId}`}
        type="button"
        onClick={dismiss}
      >
        Dismiss
      </button>
    </article>
  );
}

export function ErrorToast({
  title,
  description,
  retryLabel = "Retry",
  dismiss,
  toastId,
}: ToastComponentProps<ErrorPayload>) {
  return (
    <article className="toast-card toast-error">
      <div>
        <p className="toast-title">{title}</p>
        <p className="toast-description">{description}</p>
      </div>
      <div className="toast-actions">
        <button type="button">{retryLabel}</button>
        <button
          aria-label={`Dismiss toast ${toastId}`}
          type="button"
          onClick={dismiss}
        >
          Close
        </button>
      </div>
    </article>
  );
}

export function CustomToast({
  title,
  description,
  accent = "#1f7a8c",
  dismiss,
  toastId,
}: ToastComponentProps<CustomPayload>) {
  return (
    <article
      className="toast-card toast-custom"
      style={{ borderColor: accent }}
    >
      <div>
        <p className="toast-title">{title}</p>
        {description ? (
          <p className="toast-description">{description}</p>
        ) : null}
      </div>
      <button
        aria-label={`Dismiss toast ${toastId}`}
        type="button"
        onClick={dismiss}
      >
        Done
      </button>
    </article>
  );
}

export function ModalInfoToast({
  title,
  detail,
  dismiss,
  toastId,
}: ToastComponentProps<ModalPayload>) {
  return (
    <article className="toast-card toast-modal">
      <div>
        <p className="toast-title">{title}</p>
        {detail ? <p className="toast-description">{detail}</p> : null}
      </div>
      <button
        aria-label={`Dismiss toast ${toastId}`}
        type="button"
        onClick={dismiss}
      >
        Close
      </button>
    </article>
  );
}
