import type { ToastManager } from "@twist-toast/core";
import type { ToastComponentsMap } from "./types";

export interface ToastRegistryEntry {
  id: string;
  manager: ToastManager;
  components: ToastComponentsMap;
}

type RegistryListener = () => void;

const instanceIds = new WeakMap<object, string>();
const entries = new Map<string, ToastRegistryEntry>();
const listeners = new Set<RegistryListener>();

let sequence = 0;
let snapshot: ToastRegistryEntry[] = [];

function emitChange(): void {
  const newSnapshot = Array.from(entries.values());

  // Only update if actually changed (optimization)
  if (
    snapshot.length === newSnapshot.length &&
    snapshot.every((entry, i) => entry === newSnapshot[i])
  ) {
    return;
  }

  snapshot = newSnapshot;
  for (const listener of listeners) {
    listener();
  }
}

export function registerInstance(
  instance: object,
  manager: ToastManager,
  components: ToastComponentsMap,
): void {
  const existingId = instanceIds.get(instance);

  if (existingId) {
    entries.set(existingId, {
      id: existingId,
      manager,
      components,
    });
    emitChange();
    return;
  }

  const id = `toast-instance-${++sequence}`;
  instanceIds.set(instance, id);
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
  entries.clear();
  listeners.clear();
  sequence = 0;
  snapshot = [];
}
