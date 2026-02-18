export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export type ToastRole = 'alert' | 'status'

export type DedupeBehavior = 'ignore' | 'refresh'

export interface ToastInput {
  id?: string
  variant: string
  payload: Record<string, unknown>
  duration: number
  position: ToastPosition
  dismissOnClick: boolean
  role: ToastRole
}

export interface ToastRecord extends Omit<ToastInput, 'id' | 'duration'> {
  id: string
  duration: number
  createdAt: number
  remainingMs: number
  paused: boolean
}

export interface ToastState {
  all: ToastRecord[]
  active: ToastRecord[]
  queued: ToastRecord[]
}

export interface CreateToastManagerOptions {
  maxToasts?: number
  dedupe?: DedupeBehavior
  now?: () => number
  generateId?: () => string
}

export type ToastStateListener = (state: ToastState) => void

export interface ToastManager {
  add(input: ToastInput): string
  dismiss(id: string): void
  dismissAll(): void
  pause(id: string): void
  resume(id: string): void
  subscribe(listener: ToastStateListener): () => void
  getState(): ToastState
  destroy(): void
}
