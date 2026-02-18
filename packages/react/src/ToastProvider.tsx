import type { ToastManager, ToastPosition, ToastRecord, ToastRole, ToastState } from '@twist-toast/core'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { getInstancesSnapshot, subscribeToRegistry } from './registry'
import type { ToastComponent, ToastComponentsMap } from './types'

interface ToastProviderProps {
  children: ReactNode
}

const rootStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 9999,
}

const positionStyles: Record<ToastPosition, CSSProperties> = {
  'top-left': {
    top: 0,
    left: 0,
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  'top-center': {
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    alignItems: 'center',
    flexDirection: 'column',
  },
  'top-right': {
    top: 0,
    right: 0,
    alignItems: 'flex-end',
    flexDirection: 'column',
  },
  'bottom-left': {
    bottom: 0,
    left: 0,
    alignItems: 'flex-start',
    flexDirection: 'column-reverse',
  },
  'bottom-center': {
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    alignItems: 'center',
    flexDirection: 'column-reverse',
  },
  'bottom-right': {
    bottom: 0,
    right: 0,
    alignItems: 'flex-end',
    flexDirection: 'column-reverse',
  },
}

function getAriaLive(role: ToastRole): 'polite' | 'assertive' {
  return role === 'alert' ? 'assertive' : 'polite'
}

function getPositionBuckets(toasts: ToastRecord[]): Map<ToastPosition, ToastRecord[]> {
  const buckets = new Map<ToastPosition, ToastRecord[]>()

  for (const toast of toasts) {
    const current = buckets.get(toast.position)
    if (current) {
      current.push(toast)
      continue
    }

    buckets.set(toast.position, [toast])
  }

  return buckets
}

interface ManagerToastsProps {
  manager: ToastManager
  components: ToastComponentsMap
}

function ManagerToasts({ manager, components }: ManagerToastsProps) {
  const [state, setState] = useState<ToastState>(() => manager.getState())

  useEffect(() => {
    return manager.subscribe(setState)
  }, [manager])

  const groupedToasts = useMemo(() => getPositionBuckets(state.active), [state.active])

  return (
    <>
      {Array.from(groupedToasts.entries()).map(([position, toasts]) => {
        const containerStyle: CSSProperties = {
          position: 'absolute',
          display: 'flex',
          gap: '0.5rem',
          maxWidth: 'min(420px, calc(100vw - 1rem))',
          padding: '0.5rem',
          pointerEvents: 'none',
          ...positionStyles[position],
        }

        return (
          <div key={position} data-position={position} style={containerStyle}>
            {toasts.map((toast) => {
              const ToastView = components[toast.variant] as ToastComponent | undefined

              if (!ToastView) {
                return null
              }

              const dismiss = () => {
                manager.dismiss(toast.id)
              }

              const handleMouseEnter = () => {
                manager.pause(toast.id)
              }

              const handleMouseLeave = () => {
                manager.resume(toast.id)
              }

              return (
                <div
                  key={toast.id}
                  data-twist-toast=""
                  data-position={toast.position}
                  data-variant={toast.variant}
                  data-state={toast.paused ? 'paused' : 'active'}
                  role={toast.role}
                  aria-live={getAriaLive(toast.role)}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  onClick={toast.dismissOnClick ? dismiss : undefined}
                  style={{ pointerEvents: 'auto' }}
                >
                  <ToastView
                    {...toast.payload}
                    dismiss={dismiss}
                    toastId={toast.id}
                  />
                </div>
              )
            })}
          </div>
        )
      })}
    </>
  )
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  const instances = useSyncExternalStore(
    subscribeToRegistry,
    getInstancesSnapshot,
    getInstancesSnapshot,
  )

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined
    }

    const root = document.createElement('div')
    root.setAttribute('data-twist-toast-root', '')
    Object.assign(root.style, rootStyle)

    document.body.appendChild(root)
    setPortalRoot(root)

    return () => {
      root.remove()
    }
  }, [])

  return (
    <>
      {children}
      {portalRoot
        ? createPortal(
            <>
              {instances.map((entry) => (
                <ManagerToasts
                  key={entry.id}
                  manager={entry.manager}
                  components={entry.components}
                />
              ))}
            </>,
            portalRoot,
          )
        : null}
    </>
  )
}
