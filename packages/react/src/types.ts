import type {
  DedupeBehavior,
  ToastPosition,
  ToastRole,
} from "@twist-toast/core";
import type { ComponentType } from "react";

type EmptyPayload = Record<never, never>;

export type ToastComponentProps<TPayload extends object = EmptyPayload> =
  TPayload & {
    dismiss: () => void;
    toastId: string;
  };

export type ToastComponent<TPayload extends object = EmptyPayload> =
  ComponentType<ToastComponentProps<TPayload>>;

export type ToastComponentsMap = Record<string, ToastComponent<any>>;

export interface ToastCallOptions {
  duration?: number;
  position?: ToastPosition;
  dismissOnClick?: boolean;
  role?: ToastRole;
  id?: string;
}

export interface CreateToastOptions {
  defaultDuration?: number;
  defaultPosition?: ToastPosition;
  defaultDismissOnClick?: boolean;
  defaultRole?: ToastRole;
  maxToasts?: number;
  dedupe?: DedupeBehavior;
  now?: () => number;
  generateId?: () => string;
}

type ExtractComponentProps<TComponent> =
  TComponent extends ComponentType<infer TProps> ? TProps : never;

type ExtractPayload<TComponent> =
  Omit<
    ExtractComponentProps<TComponent>,
    "dismiss" | "toastId"
  > extends infer TPayload extends object
    ? TPayload
    : EmptyPayload;

type RequiredKeys<T extends object> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

type VariantMethod<TComponent extends ToastComponent<any>> =
  RequiredKeys<ExtractPayload<TComponent>> extends never
    ? (
        payload?: ExtractPayload<TComponent>,
        options?: ToastCallOptions,
      ) => string
    : (
        payload: ExtractPayload<TComponent>,
        options?: ToastCallOptions,
      ) => string;

export type ToastInstance<TComponents extends ToastComponentsMap> = {
  [TVariant in keyof TComponents]: VariantMethod<TComponents[TVariant]>;
} & {
  dismiss: (id: string) => void;
  dismissAll: () => void;
  destroy: () => void;
};
