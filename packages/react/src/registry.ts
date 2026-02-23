import type { ToastManager } from "@twist-toast/core";
import type { ToastComponentsMap } from "./types";

export interface ToastRegistryEntry {
  id: string;
  manager: ToastManager;
  components: ToastComponentsMap;
}

type RegistryListener = () => void;

let instanceIds = new WeakMap<object, string>();
const entries = new Map<string, ToastRegistryEntry>();
const listeners = new Set<RegistryListener>();

let sequence = 0;
let snapshot: ToastRegistryEntry[] = [];

function rebuildSnapshot(): void {
  snapshot = Array.from(entries.values());
}

function emitChange(): void {
  rebuildSnapshot();
  for (const listener of listeners) {
    listener();
  }
}

export function registerInstance(
  instance: object,
  manager: ToastManager,
  components: ToastComponentsMap,
): void {
  let id = instanceIds.get(instance);
  if (!id) {
    id = `toast-instance-${++sequence}`;
    instanceIds.set(instance, id);
  }

  entries.set(id, {
    id,
    manager,
    components,
  });
  emitChange();
}

/**
 * Unregister a toast instance and clean up resources
 */
export function unregisterInstance(instance: object): void {
  const id = instanceIds.get(instance);
  if (!id) {
    return;
  }

  entries.delete(id);
  instanceIds.delete(instance);
  emitChange();
}

export function getInstancesSnapshot(): ToastRegistryEntry[] {
  return snapshot;
}

export function subscribeToRegistry(listener: RegistryListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function __resetRegistryForTests(): void {
  instanceIds = new WeakMap();
  entries.clear();
  listeners.clear();
  sequence = 0;
  snapshot = [];
}
