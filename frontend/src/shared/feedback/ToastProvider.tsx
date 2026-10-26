import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import { ToastContext } from './toast-context'
import type {
  ToastInput,
  ToastType,
} from './toast-context'

import './ToastProvider.css'

interface ToastItem extends ToastInput {
  id: number
}

interface ToastProviderProps {
  children: ReactNode
}

interface ToastMessageProps {
  toast: ToastItem
  onDismiss: (id: number) => void
}

const TOAST_TITLES: Record<ToastType, string> = {
  success: 'Operación completada',
  error: 'No se pudo completar',
  info: 'Información',
}

function ToastMessage({
  toast,
  onDismiss,
}: ToastMessageProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [hasFocus, setHasFocus] = useState(false)

  useEffect(() => {
    if (
      toast.type === 'error' ||
      isHovered ||
      hasFocus
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      onDismiss(toast.id)
    }, 6_000)

    return () => window.clearTimeout(timeoutId)
  }, [
    toast.id,
    toast.type,
    isHovered,
    hasFocus,
    onDismiss,
  ])

  return (
    <div
      className={`app-toast app-toast--${toast.type}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setHasFocus(true)}
      onBlurCapture={(event) => {
        if (
          !event.currentTarget.contains(
            event.relatedTarget,
          )
        ) {
          setHasFocus(false)
        }
      }}
    >
      <div
        className="app-toast-content"
        role={toast.type === 'error' ? 'alert' : 'status'}
        aria-atomic="true"
      >
        <strong>{TOAST_TITLES[toast.type]}</strong>
        <p>{toast.message}</p>
      </div>

      <button
        type="button"
        className="app-toast-close"
        aria-label="Cerrar aviso"
        onClick={() => onDismiss(toast.id)}
      >
        ×
      </button>
    </div>
  )
}

export function ToastProvider({
  children,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismissToast = useCallback((id: number) => {
    setToasts((current) =>
      current.filter((toast) => toast.id !== id),
    )
  }, [])

  const showToast = useCallback((input: ToastInput) => {
    const toast: ToastItem = {
      ...input,
      id: ++nextId.current,
    }

    setToasts((current) => [...current, toast])
  }, [])

  const contextValue = useMemo(
    () => ({ showToast }),
    [showToast],
  )

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      <section
        className="app-toast-container"
        aria-label="Avisos del sistema"
      >
        {toasts.map((toast) => (
          <ToastMessage
            key={toast.id}
            toast={toast}
            onDismiss={dismissToast}
          />
        ))}
      </section>
    </ToastContext.Provider>
  )
}