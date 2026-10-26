import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { getCurrentUser, login } from '../api/auth.api'
import type { CurrentUser } from '../types/auth.types'

interface LoginFormProps {
  onLoginSuccess: (accessToken: string, user: CurrentUser) => void
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const formId = useId()
  const isActive = useRef(false)
  const submissionInProgress = useRef(false)
  const hasAuthenticated = useRef(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    isActive.current = true

    return () => {
      isActive.current = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submissionInProgress.current || hasAuthenticated.current) return

    submissionInProgress.current = true
    setErrorMessage('')
    setIsSubmitting(true)

    let session: { accessToken: string; user: CurrentUser } | null = null

    try {
      const token = await login({ email: email.trim(), password })

      if (!isActive.current) return

      const user = await getCurrentUser(token.access_token)
      session = { accessToken: token.access_token, user }
    } catch (error: unknown) {
      if (!isActive.current) return

      if (
        error instanceof DOMException &&
        error.name === 'TimeoutError'
      ) {
        setErrorMessage(
          'El servidor tardó demasiado. Inténtalo nuevamente.',
        )
      } else if (error instanceof TypeError) {
        setErrorMessage(
          'No se pudo conectar con el servidor. Inténtalo nuevamente.',
        )
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'No se pudo iniciar sesión.',
        )
      }
    } finally {
      submissionInProgress.current = false

      if (isActive.current) {
        setIsSubmitting(false)
      }
    }

    if (session && isActive.current) {
      hasAuthenticated.current = true
      setPassword('')
      setShowPassword(false)
      onLoginSuccess(session.accessToken, session.user)
    }
  }

  return (
    <form
      className="auth-login-form"
      onSubmit={handleSubmit}
      aria-busy={isSubmitting}
    >
      <fieldset
        disabled={isSubmitting}
        className="auth-login-fields"
      >
        <legend className="auth-login-sr-only">
          Datos de acceso
        </legend>

        <div className="auth-login-field">
          <label htmlFor={`${formId}-email`}>Correo electrónico</label>
          <input
            id={`${formId}-email`}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={254}
            value={email}
            placeholder="nombre@correo.com"
            aria-describedby={errorMessage ? `${formId}-error` : undefined}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="auth-login-field">
          <label htmlFor={`${formId}-password`}>Contraseña</label>
          <div className="auth-login-password">
            <input
              id={`${formId}-password`}
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={128}
              value={password}
              aria-describedby={errorMessage ? `${formId}-error` : undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="auth-login-password-toggle"
              aria-label="Mostrar contraseña"
              aria-pressed={showPassword}
              aria-controls={`${formId}-password`}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>

        <button type="submit" className="auth-login-submit">
          {isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
          {!isSubmitting && <span aria-hidden="true">→</span>}
        </button>
      </fieldset>

      <div className="auth-login-status" role="status">
        {isSubmitting ? 'Verificando tus datos de acceso…' : ''}
      </div>

      {errorMessage && (
        <p className="auth-login-error" id={`${formId}-error`} role="alert">
          {errorMessage}
        </p>
      )}
    </form>
  )
}
