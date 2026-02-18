import { createToast } from '@twist-toast/react'
import type { ToastComponentProps } from '@twist-toast/react'
import { useState } from 'react'
import './App.css'

function SuccessToast({ title, dismiss }: ToastComponentProps<{ title: string }>) {
  return (
    <div className="toast toast-success">
      <strong>{title}</strong>
      <button type="button" onClick={dismiss}>
        ×
      </button>
    </div>
  )
}

function ErrorToast({
  title,
  description,
  dismiss,
}: ToastComponentProps<{ title: string; description?: string }>) {
  return (
    <div className="toast toast-error">
      <div>
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      <button type="button" onClick={dismiss}>
        ×
      </button>
    </div>
  )
}

function InfoToast({ message, dismiss }: ToastComponentProps<{ message: string }>) {
  return (
    <div className="toast toast-info">
      <span>{message}</span>
      <button type="button" onClick={dismiss}>
        ×
      </button>
    </div>
  )
}

const toast = createToast(
  {
    success: SuccessToast,
    error: ErrorToast,
    info: InfoToast,
  },
  {
    defaultDuration: 3500,
    defaultPosition: 'top-right',
    maxToasts: 3,
  },
)

function App() {
  const [lastToastId, setLastToastId] = useState<string | null>(null)

  return (
    <main className="app">
      <h1>twist-toast v1 playground</h1>
      <p>Trigger toasts and test queueing, positions, pause-on-hover, and dismiss controls.</p>

      <section className="button-grid">
        <button
          type="button"
          onClick={() => {
            const id = toast.success({ title: 'Saved successfully' })
            setLastToastId(id)
          }}
        >
          Success
        </button>

        <button
          type="button"
          onClick={() => {
            const id = toast.error(
              {
                title: 'Failed to save',
                description: 'Try again in a few seconds.',
              },
              {
                role: 'alert',
              },
            )
            setLastToastId(id)
          }}
        >
          Error (alert)
        </button>

        <button
          type="button"
          onClick={() => {
            const id = toast.info(
              { message: 'This toast lasts 1 second' },
              { duration: 1000 },
            )
            setLastToastId(id)
          }}
        >
          Info (1s)
        </button>

        <button
          type="button"
          onClick={() => {
            const id = toast.info(
              { message: 'Bottom center toast' },
              { position: 'bottom-center' },
            )
            setLastToastId(id)
          }}
        >
          Bottom Center
        </button>

        <button
          type="button"
          onClick={() => {
            const id = toast.info(
              { message: 'No auto-dismiss. Click the toast to close.' },
              { duration: 0 },
            )
            setLastToastId(id)
          }}
        >
          Sticky Toast
        </button>

        <button
          type="button"
          onClick={() => {
            for (let i = 1; i <= 6; i += 1) {
              toast.info({ message: `Queued toast #${i}` })
            }
          }}
        >
          Queue 6 Toasts
        </button>
      </section>

      <section className="actions">
        <button
          type="button"
          onClick={() => {
            if (lastToastId) {
              toast.dismiss(lastToastId)
              setLastToastId(null)
            }
          }}
          disabled={!lastToastId}
        >
          Dismiss Last Toast
        </button>

        <button
          type="button"
          onClick={() => {
            toast.dismissAll()
            setLastToastId(null)
          }}
        >
          Dismiss All
        </button>
      </section>
    </main>
  )
}

export default App
