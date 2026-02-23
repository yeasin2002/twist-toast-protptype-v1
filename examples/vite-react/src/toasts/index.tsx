import type { ToastComponentProps } from "@twist-toast/react";

const closeButtonClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/30 bg-white/10 text-base leading-none transition hover:bg-white/20";

export function SuccessToast({
  title,
  dismiss,
}: ToastComponentProps<{ title: string }>) {
  return (
    <div className="pointer-events-auto flex w-[min(92vw,24rem)] items-start justify-between gap-3 rounded-xl border border-emerald-300/50 bg-emerald-500 px-4 py-3 text-emerald-50 shadow-lg">
      <div className="space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100/80">
          Success
        </p>
        <strong className="text-sm font-semibold">{title}</strong>
      </div>
      <button
        type="button"
        className={closeButtonClass}
        onClick={dismiss}
        aria-label="Dismiss success toast"
      >
        ×
      </button>
    </div>
  );
}

export function ErrorToast({
  title,
  description,
  dismiss,
}: ToastComponentProps<{ title: string; description?: string }>) {
  return (
    <div className="pointer-events-auto flex w-[min(92vw,24rem)] items-start justify-between gap-3 rounded-xl border border-red-300/50 bg-red-500 px-4 py-3 text-red-50 shadow-lg">
      <div className="space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-red-100/80">
          Error
        </p>
        <strong className="text-sm font-semibold">{title}</strong>
        {description ? (
          <p className="text-xs text-red-100">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        className={closeButtonClass}
        onClick={dismiss}
        aria-label="Dismiss error toast"
      >
        ×
      </button>
    </div>
  );
}

export function InfoToast({
  message,
  dismiss,
}: ToastComponentProps<{ message: string }>) {
  return (
    <div className="pointer-events-auto flex w-[min(92vw,24rem)] items-start justify-between gap-3 rounded-xl border border-blue-300/50 bg-blue-500 px-4 py-3 text-blue-50 shadow-lg">
      <div className="space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-100/80">
          Info
        </p>
        <span className="text-sm">{message}</span>
      </div>
      <button
        type="button"
        className={closeButtonClass}
        onClick={dismiss}
        aria-label="Dismiss info toast"
      >
        ×
      </button>
    </div>
  );
}
