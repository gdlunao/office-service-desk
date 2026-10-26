import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import {
  SolutionAttemptsApiError,
  startSolutionAttempt,
} from '../api/solution-attempts.api'
import type {
  SolutionAttempt,
} from '../types/solution-attempt.types'

import './SolutionAttemptForm.css'

interface StartSolutionAttemptFormProps {
  accessToken: string
  incidentId: number
  disabled?: boolean
  onAttemptStarted: (attempt: SolutionAttempt) => void
  onSessionExpired: () => void
}

export function StartSolutionAttemptForm({
  accessToken,
  incidentId,
  disabled = false,
  onAttemptStarted,
  onSessionExpired,
}: StartSolutionAttemptFormProps) {
  const fieldId = useId()
  const helpId = useId()
  const errorId = useId()

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const submittingRef = useRef(false)
  const isActiveRef = useRef(false)

  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    isActiveRef.current = true

    return () => {
      isActiveRef.current = false
    }
  }, [])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      submittingRef.current ||
      disabled ||
      hasStarted
    ) {
      return
    }

    setErrorMessage('')
    setSuccessMessage('')

    const cleanDescription = description.trim()

    if (
      cleanDescription.length < 10 ||
      cleanDescription.length > 10_000
    ) {
      setErrorMessage(
        'Describe la solución propuesta usando entre 10 y 10 000 caracteres.',
      )
      textareaRef.current?.focus()
      return
    }

    submittingRef.current = true
    setIsSubmitting(true)

    let createdAttempt: SolutionAttempt | null = null

    try {
      createdAttempt = await startSolutionAttempt(
        accessToken,
        incidentId,
        {
          solution_description: cleanDescription,
        },
      )

      if (!isActiveRef.current) return

      setHasStarted(true)
      setDescription('')
      setSuccessMessage(
        `Intento ${createdAttempt.attempt_number} iniciado correctamente.`,
      )
    } catch (error: unknown) {
      if (!isActiveRef.current) return

      if (
        error instanceof SolutionAttemptsApiError &&
        error.status === 401
      ) {
        onSessionExpired()
        return
      }

      if (error instanceof SolutionAttemptsApiError) {
        setErrorMessage(error.message)
      } else if (
        error instanceof DOMException &&
        error.name === 'TimeoutError'
      ) {
        setErrorMessage(
          'El servidor tardó demasiado. Actualiza los intentos para comprobar si se registró antes de volver a enviarlo.',
        )
      } else {
        setErrorMessage(
          'No se pudo confirmar el inicio. Comprueba la conexión y actualiza los intentos antes de reintentar.',
        )
      }
    } finally {
      submittingRef.current = false

      if (isActiveRef.current) {
        setIsSubmitting(false)
      }
    }

    if (
      createdAttempt !== null &&
      isActiveRef.current
    ) {
      onAttemptStarted(createdAttempt)
    }
  }

  return (
    <form
      className="solution-attempt-form"
      onSubmit={handleSubmit}
      aria-busy={isSubmitting}
      noValidate
    >
      <fieldset
        disabled={disabled || isSubmitting || hasStarted}
      >
        <legend>Iniciar un intento de solución</legend>

        <label htmlFor={fieldId}>
          ¿Qué solución vas a aplicar?
        </label>

        <p
          id={helpId}
          className="solution-attempt-form-help"
        >
          Describe la acción que realizarás para recuperar el servicio.
          Al iniciar se registrará la fecha y hora del intento.
        </p>

        <textarea
          ref={textareaRef}
          id={fieldId}
          name="solution_description"
          rows={5}
          required
          minLength={10}
          maxLength={10_000}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value)
            setErrorMessage('')
          }}
          aria-describedby={
            errorMessage
              ? `${helpId} ${errorId}`
              : helpId
          }
        />

        <p className="solution-attempt-form-counter">
          {description.length.toLocaleString('es-PE')}
          {' / 10 000 caracteres'}
        </p>

        <div className="solution-attempt-form-actions">
          <button
            type="submit"
            className="primary-button"
          >
            {isSubmitting
              ? 'Iniciando intento…'
              : hasStarted
                ? 'Intento iniciado'
                : 'Iniciar intento de solución'}
          </button>
        </div>
      </fieldset>

      {errorMessage && (
        <p
          id={errorId}
          className="form-error"
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p
          className="solution-attempt-form-success"
          role="status"
        >
          {successMessage}
        </p>
      )}
    </form>
  )
}