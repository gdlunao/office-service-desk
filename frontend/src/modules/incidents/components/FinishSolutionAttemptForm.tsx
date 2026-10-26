import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import {
  finishSolutionAttempt,
  SolutionAttemptsApiError,
} from '../api/solution-attempts.api'
import type {
  SolutionAttempt,
} from '../types/solution-attempt.types'

import './SolutionAttemptForm.css'

interface FinishSolutionAttemptFormProps {
  accessToken: string
  attempt: SolutionAttempt
  onAttemptFinished: (attempt: SolutionAttempt) => void
  onSessionExpired: () => void
}

type AttemptOutcome = '' | 'failed' | 'recovered'

export function FinishSolutionAttemptForm({
  accessToken,
  attempt,
  onAttemptFinished,
  onSessionExpired,
}: FinishSolutionAttemptFormProps) {
  const outcomeId = useId()
  const descriptionId = useId()
  const actionsId = useId()
  const evidenceId = useId()

  const outcomeRef = useRef<HTMLSelectElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const actionsRef = useRef<HTMLTextAreaElement>(null)
  const evidenceRef = useRef<HTMLTextAreaElement>(null)

  const submittingRef = useRef(false)
  const isActiveRef = useRef(false)

  const [outcome, setOutcome] = useState<AttemptOutcome>('')
  const [description, setDescription] = useState(
    attempt.solution_description ?? '',
  )
  const [technicalActions, setTechnicalActions] = useState('')
  const [recoveryEvidence, setRecoveryEvidence] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasFinished, setHasFinished] = useState(false)
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
      hasFinished ||
      attempt.status !== 'in_progress'
    ) {
      return
    }

    setErrorMessage('')
    setSuccessMessage('')

    if (outcome === '') {
      setErrorMessage('Selecciona el resultado del intento.')
      outcomeRef.current?.focus()
      return
    }

    const cleanDescription = description.trim()
    const cleanActions = technicalActions.trim()
    const cleanEvidence = recoveryEvidence.trim()

    if (
      cleanDescription.length < 10 ||
      cleanDescription.length > 10_000
    ) {
      setErrorMessage(
        'La descripción debe tener entre 10 y 10 000 caracteres.',
      )
      descriptionRef.current?.focus()
      return
    }

    if (
      cleanActions.length < 10 ||
      cleanActions.length > 10_000
    ) {
      setErrorMessage(
        'Las acciones técnicas deben tener entre 10 y 10 000 caracteres.',
      )
      actionsRef.current?.focus()
      return
    }

    if (
      outcome === 'recovered' &&
      cleanEvidence.length < 10
    ) {
      setErrorMessage(
        'Para registrar la recuperación, explica cómo la comprobaste usando al menos 10 caracteres.',
      )
      evidenceRef.current?.focus()
      return
    }

    if (
      cleanEvidence.length > 10_000 ||
      (
        cleanEvidence.length > 0 &&
        cleanEvidence.length < 10
      )
    ) {
      setErrorMessage(
        'Si registras evidencia, debe tener entre 10 y 10 000 caracteres.',
      )
      evidenceRef.current?.focus()
      return
    }

    submittingRef.current = true
    setIsSubmitting(true)

    let updatedAttempt: SolutionAttempt | null = null

    try {
      updatedAttempt = await finishSolutionAttempt(
        accessToken,
        attempt.incident_id,
        attempt.id,
        {
          status: outcome,
          solution_description: cleanDescription,
          technical_actions: cleanActions,
          recovery_evidence: cleanEvidence || null,
        },
      )

      if (!isActiveRef.current) return

      setHasFinished(true)
      setSuccessMessage(
        outcome === 'recovered'
          ? 'Recuperación registrada. La incidencia queda pendiente de confirmación del reportante.'
          : 'Intento finalizado sin recuperación. La incidencia continúa en atención.',
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
          'El servidor tardó demasiado. Actualiza el detalle para comprobar el resultado antes de volver a enviarlo.',
        )
      } else {
        setErrorMessage(
          'No se pudo confirmar la operación. Comprueba la conexión y actualiza el detalle antes de reintentar.',
        )
      }
    } finally {
      submittingRef.current = false

      if (isActiveRef.current) {
        setIsSubmitting(false)
      }
    }

    if (
      updatedAttempt !== null &&
      isActiveRef.current
    ) {
      onAttemptFinished(updatedAttempt)
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
        disabled={
          isSubmitting ||
          hasFinished ||
          attempt.status !== 'in_progress'
        }
      >
        <legend>
          Finalizar intento {attempt.attempt_number}
        </legend>

        <label htmlFor={outcomeId}>
          Resultado del intento
        </label>

        <select
          ref={outcomeRef}
          id={outcomeId}
          name="status"
          value={outcome}
          required
          onChange={(event) => {
            const value = event.target.value

            if (
              value === '' ||
              value === 'failed' ||
              value === 'recovered'
            ) {
              setOutcome(value)
              setErrorMessage('')
            }
          }}
        >
          <option value="">Selecciona un resultado</option>
          <option value="failed">
            Sin recuperación: el problema continúa
          </option>
          <option value="recovered">
            Recuperación comprobada del servicio
          </option>
        </select>

        <label htmlFor={descriptionId}>
          Solución aplicada o intentada
        </label>

        <p className="solution-attempt-form-help">
          Actualiza la propuesta inicial para describir
          lo que efectivamente realizaste.
        </p>

        <textarea
          ref={descriptionRef}
          id={descriptionId}
          name="solution_description"
          rows={4}
          required
          minLength={10}
          maxLength={10_000}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value)
            setErrorMessage('')
          }}
        />

        <label htmlFor={actionsId}>
          Acciones técnicas realizadas
        </label>

        <p className="solution-attempt-form-help">
          Explica los pasos, ajustes y comprobaciones realizados.
        </p>

        <textarea
          ref={actionsRef}
          id={actionsId}
          name="technical_actions"
          rows={5}
          required
          minLength={10}
          maxLength={10_000}
          value={technicalActions}
          onChange={(event) => {
            setTechnicalActions(event.target.value)
            setErrorMessage('')
          }}
        />

        <label htmlFor={evidenceId}>
          Evidencia de recuperación
          {outcome === 'recovered'
            ? ' (obligatoria)'
            : ' (opcional)'}
        </label>

        <p className="solution-attempt-form-help">
          Describe la prueba y el resultado que demuestran
          que el servicio volvió a funcionar. Puedes complementar
          esta descripción con los archivos adjuntos de la incidencia.
        </p>

        <textarea
          ref={evidenceRef}
          id={evidenceId}
          name="recovery_evidence"
          rows={5}
          required={outcome === 'recovered'}
          maxLength={10_000}
          value={recoveryEvidence}
          onChange={(event) => {
            setRecoveryEvidence(event.target.value)
            setErrorMessage('')
          }}
        />

        {outcome !== '' && (
          <p className="solution-attempt-form-help">
            {outcome === 'recovered'
              ? 'La incidencia quedará Resuelta, pendiente de confirmación. El reportante podrá confirmar el cierre o devolverla.'
              : 'La incidencia seguirá En atención y podrás iniciar otra solución.'}
          </p>
        )}

        <div className="solution-attempt-form-actions">
          <button
            type="submit"
            className="primary-button"
          >
            {isSubmitting
              ? 'Guardando resultado…'
              : hasFinished
                ? 'Resultado registrado'
                : 'Guardar resultado del intento'}
          </button>
        </div>
      </fieldset>

      {errorMessage && (
        <p className="form-error" role="alert">
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