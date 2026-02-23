import type { InternalState, ToastRecord, ToastState } from "../types";

export function addToast(
  state: InternalState,
  toast: ToastRecord,
): InternalState {
  const byId = new Map(state.byId);
  byId.set(toast.id, toast);

  return {
    byId,
    order: [...state.order, toast.id],
  };
}

export function removeToast(state: InternalState, id: string): InternalState {
  if (!state.byId.has(id)) {
    return state;
  }

  const byId = new Map(state.byId);
  byId.delete(id);

  return {
    byId,
    order: state.order.filter((item) => item !== id),
  };
}

export function updateToast(
  state: InternalState,
  id: string,
  patch: Partial<ToastRecord>,
): InternalState {
  const existing = state.byId.get(id);
  if (!existing) {
    return state;
  }

  const byId = new Map(state.byId);
  byId.set(id, { ...existing, ...patch });

  return {
    byId,
    order: state.order,
  };
}

export function createStateSnapshot(
  state: InternalState,
  maxToasts: number,
): ToastState {
  const all: ToastRecord[] = [];

  for (const id of state.order) {
    const toast = state.byId.get(id);
    if (toast) {
      all.push(toast);
    }
  }

  return {
    all,
    active: all.slice(0, maxToasts),
    queued: all.slice(maxToasts),
  };
}
