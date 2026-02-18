import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ToastProvider, createToast } from '../src'
import { __resetRegistryForTests } from '../src/registry'
import type { ToastComponentProps } from '../src/types'

function SuccessToast({ title }: ToastComponentProps<{ title: string }>) {
  return <div>{title}</div>
}

describe('react wrapper smoke test', () => {
  let mountNode: HTMLDivElement

  beforeEach(() => {
    __resetRegistryForTests()
    document.body.innerHTML = ''
    mountNode = document.createElement('div')
    document.body.appendChild(mountNode)
  })

  afterEach(() => {
    mountNode.remove()
    document.body.innerHTML = ''
  })

  it('renders and dismisses a toast', () => {
    const root = createRoot(mountNode)
    const toast = createToast(
      {
        success: SuccessToast,
      },
      {
        defaultDuration: 0,
      },
    )

    act(() => {
      root.render(
        <ToastProvider>
          <div>App</div>
        </ToastProvider>,
      )
    })

    act(() => {
      toast.success({ title: 'Saved' })
    })

    const toastElement = document.querySelector('[data-twist-toast]') as
      | HTMLElement
      | null
    expect(toastElement).not.toBeNull()
    expect(document.body.textContent).toContain('Saved')

    if (toastElement) {
      act(() => {
        toastElement.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
    }

    expect(document.querySelector('[data-twist-toast]')).toBeNull()

    act(() => {
      root.unmount()
    })
  })
})
