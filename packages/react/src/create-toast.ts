import type { CreateToastManagerOptions, ToastInput } from "@twist-toast/core";
import {
  DEFAULT_DISMISS_ON_CLICK,
  DEFAULT_DURATION,
  DEFAULT_POSITION,
  DEFAULT_ROLE,
  createToastManager,
} from "@twist-toast/core";
import { registerInstance, unregisterInstance } from "./registry";
import type {
  CreateToastOptions,
  ToastCallOptions,
  ToastComponentsMap,
  ToastInstance,
} from "./types";

function toPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as Record<string, unknown>;
}

export function createToast<TComponents extends ToastComponentsMap>(
  components: TComponents,
  options: CreateToastOptions = {},
): ToastInstance<TComponents> {
  const managerOptions: CreateToastManagerOptions = {};

  if (options.maxToasts !== undefined) {
    managerOptions.maxToasts = options.maxToasts;
  }
  if (options.dedupe !== undefined) {
    managerOptions.dedupe = options.dedupe;
  }
  if (options.now !== undefined) {
    managerOptions.now = options.now;
  }
  if (options.generateId !== undefined) {
    managerOptions.generateId = options.generateId;
  }

  const manager = createToastManager(managerOptions);

  const defaults = {
    duration: options.defaultDuration ?? DEFAULT_DURATION,
    position: options.defaultPosition ?? DEFAULT_POSITION,
    dismissOnClick: options.defaultDismissOnClick ?? DEFAULT_DISMISS_ON_CLICK,
    role: options.defaultRole ?? DEFAULT_ROLE,
  } as const;

  const methods = {} as {
    [K in keyof TComponents]: ToastInstance<TComponents>[K];
  };

  for (const variant of Object.keys(components) as Array<keyof TComponents>) {
    const method = (payload: unknown, callOptions?: ToastCallOptions) => {
      const optionsWithDefaults = {
        duration: callOptions?.duration ?? defaults.duration,
        position: callOptions?.position ?? defaults.position,
        dismissOnClick: callOptions?.dismissOnClick ?? defaults.dismissOnClick,
        role: callOptions?.role ?? defaults.role,
      };

      const input: ToastInput = {
        variant: String(variant),
        payload: toPayload(payload),
        duration: optionsWithDefaults.duration,
        position: optionsWithDefaults.position,
        dismissOnClick: optionsWithDefaults.dismissOnClick,
        role: optionsWithDefaults.role,
      };

      if (callOptions?.id !== undefined) {
        input.id = callOptions.id;
      }

      return manager.add(input);
    };

    methods[variant] = method as ToastInstance<TComponents>[typeof variant];
  }

  const instance = {
    ...methods,
    dismiss: (id: string) => {
      manager.dismiss(id);
    },
    dismissAll: () => {
      manager.dismissAll();
    },
    destroy: () => {
      manager.destroy();
      unregisterInstance(instance);
    },
  } as ToastInstance<TComponents>;

  registerInstance(instance, manager, components);

  return instance;
}
