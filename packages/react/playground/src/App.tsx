import { createToast } from '../../src'
import type { ToastComponentProps } from '../../src'

const toast = createToast({
  success: ({
    title,
    dismiss,
  }: ToastComponentProps<{ title: string }>) => (
    <div style={{ background: '#16a34a', color: '#fff', padding: '0.75rem 1rem', borderRadius: 8 }}>
      <strong>{title}</strong>
      <button
        type="button"
        style={{ marginLeft: 12 }}
        onClick={dismiss}
      >
        Close
      </button>
    </div>
  ),
})

export function App() {
  return (
    <button
      type="button"
      onClick={() => {
        toast.success({ title: 'Playground toast' })
      }}
    >
      Show toast
    </button>
  )
}
