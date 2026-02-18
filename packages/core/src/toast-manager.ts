import type {
  CreateToastManagerOptions,
  ToastInput,
  ToastManager,
  ToastRecord,
  ToastState,
  ToastStateListener,
} from './types'

type TimerHandle = ReturnType<typeof setTimeout>

interface InternalState {
  order: string[]
  byId: Map<string, ToastRecord>
}

interface TimerEntry {
  handle: TimerHandle
  startedAt: number
}

function addToast(state: InternalState, toast: ToastRecord): InternalState {
  const byId = new Map(state.byId)
  byId.set(toast.id, toast)

  return {
    byId,
    order: [...state.order, toast.id],
  }
}

function removeToast(state: InternalState, id: string): InternalState {
  if (!state.byId.has(id)) {
    return state
  }

  const byId = new Map(state.byId)
  byId.delete(id)

  return {
    byId,
    order: state.order.filter((item) => item !== id),
  }
}

function updateToast(
  state: InternalState,
  id: string,
  patch: Partial<ToastRecord>,
): InternalState {
  const existing = state.byId.get(id)
  if (!existing) {
    return state
  }

  const byId = new Map(state.byId)
  byId.set(id, { ...existing, ...patch })

  return {
    byId,
    order: state.order,
  }
}

function toOrderedToasts(state: InternalState): ToastRecord[] {
  const all: ToastRecord[] = []

  for (const id of state.order) {
    const toast = state.byId.get(id)
    if (toast) {
      all.push(toast)
    }
  }

  return all
}

function createStateSnapshot(state: InternalState, maxToasts: number): ToastState {
  const all = toOrderedToasts(state)

  return {
    all,
    active: all.slice(0, maxToasts),
    queued: all.slice(maxToasts),
  }
}

function defaultGenerateId(now: () => number): string {
  return `toast-${now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function createToastManager(
  options: CreateToastManagerOptions = {},
): ToastManager {
  const maxToasts = Math.max(1, options.maxToasts ?? 5)
  const dedupe = options.dedupe ?? 'ignore'
  const now = options.now ?? Date.now
  const generateId = options.generateId ?? (() => defaultGenerateId(now))

  let state: InternalState = {
    order: [],
    byId: new Map(),
  }

  const timers = new Map<string, TimerEntry>()
  const listeners = new Set<ToastStateListener>()

  function getState(): ToastState {
    return createStateSnapshot(state, maxToasts)
  }

  function notify(): void {
    const snapshot = getState()
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  function clearTimer(id: string): void {
    const timer = timers.get(id)
    if (!timer) {
      return
    }

    clearTimeout(timer.handle)
    timers.delete(id)
  }

  function isActiveToast(id: string): boolean {
    return getState().active.some((toast) => toast.id === id)
  }

  function syncTimers(): void {
    const snapshot = getState()
    const activeIds = new Set(snapshot.active.map((toast) => toast.id))

    for (const id of Array.from(timers.keys())) {
      const toast = state.byId.get(id)
      const shouldStop =
        !toast ||
        !activeIds.has(id) ||
        toast.paused ||
        toast.duration <= 0 ||
        toast.remainingMs <= 0

      if (shouldStop) {
        clearTimer(id)
      }
    }

    for (const toast of snapshot.active) {
      if (
        toast.paused ||
        toast.duration <= 0 ||
        toast.remainingMs <= 0 ||
        timers.has(toast.id)
      ) {
        continue
      }

      const startedAt = now()
      const handle = setTimeout(() => {
        dismiss(toast.id)
      }, toast.remainingMs)

      timers.set(toast.id, { handle, startedAt })
    }
  }

  function add(input: ToastInput): string {
    const id = input.id ?? generateId()
    const existing = state.byId.get(id)

    if (existing) {
      if (dedupe === 'ignore') {
        return id
      }

      clearTimer(id)
      state = removeToast(state, id)
    }

    const duration = Math.max(0, input.duration)

    const toast: ToastRecord = {
      ...input,
      id,
      duration,
      createdAt: now(),
      remainingMs: duration,
      paused: false,
    }

    state = addToast(state, toast)
    syncTimers()
    notify()

    return id
  }

  function dismiss(id: string): void {
    if (!state.byId.has(id)) {
      return
    }

    clearTimer(id)
    state = removeToast(state, id)
    syncTimers()
    notify()
  }

  function dismissAll(): void {
    for (const id of Array.from(timers.keys())) {
      clearTimer(id)
    }

    state = {
      order: [],
      byId: new Map(),
    }

    notify()
  }

  function pause(id: string): void {
    const toast = state.byId.get(id)
    if (!toast || toast.paused || toast.duration <= 0 || !isActiveToast(id)) {
      return
    }

    const timer = timers.get(id)
    if (!timer) {
      return
    }

    const elapsed = Math.max(0, now() - timer.startedAt)
    const remainingMs = Math.max(0, toast.remainingMs - elapsed)

    clearTimer(id)
    state = updateToast(state, id, {
      paused: true,
      remainingMs,
    })

    syncTimers()
    notify()
  }

  function resume(id: string): void {
    const toast = state.byId.get(id)
    if (!toast || !toast.paused) {
      return
    }

    state = updateToast(state, id, {
      paused: false,
    })

    syncTimers()
    notify()
  }

  function subscribe(listener: ToastStateListener): () => void {
    listeners.add(listener)
    listener(getState())

    return () => {
      listeners.delete(listener)
    }
  }

  function destroy(): void {
    for (const id of Array.from(timers.keys())) {
      clearTimer(id)
    }

    listeners.clear()

    state = {
      order: [],
      byId: new Map(),
    }
  }

  return {
    add,
    dismiss,
    dismissAll,
    pause,
    resume,
    subscribe,
    getState,
    destroy,
  }
}
