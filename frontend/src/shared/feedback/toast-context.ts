import { createContext, useContext } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastInput {
  message: string
  type: ToastType
}

export interface ToastContextValue {
  showToast: (toast: ToastInput) => void
}

export const ToastContext =
  createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)

  if (context === null) {
    throw new Error(
      'useToast debe utilizarse dentro de ToastProvider.',
    )
  }

  return context
}