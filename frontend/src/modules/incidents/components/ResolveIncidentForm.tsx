import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import {
  IncidentsApiError,
  resolveIncident,
} from '../api/incidents.api'
import type { Incident } from '../types/incident.types'

interface ResolveIncidentFormProps {
  accessToken: string
  incidentId: number
  onIncidentResolved: (incident: Incident) => void
  onSessionExpired: () => void
}

export function ResolveIncidentForm({
  accessToken,
  incidentId,
  onIncidentResolved,
  onSessionExpired,
}: ResolveIncidentFormProps) {
  const [summary, setSummary] = useState('')
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [requiresRefresh, setRequiresRefresh] = useState(false)
  const [isResolved, setIsResolved] = useState(false)

  const isMounted = useRef(false)
  const submissionInProgress = useRef(false)

  const summaryId = `resolution-summary-${incidentId}`
  const confirmationId = `recovery-confirmation-${incidentId}`
  const helpId = `resolution-help-${incidentId}`
  const errorId = `resolution-error-${incidentId}`

  useEffect(() => {
    isMounted.current = true

    return () => {
      isMounted.current = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (
      submissionInProgress.current ||
      requiresRefresh ||
      isResolved
    ) {
      return
    }

    const cleanedSummary = summary.trim()

    if (
      cleanedSummary.length < 10 ||
      cleanedSummary.length > 10_000
    ) {
      setErrorMessage(
        'Describe la solución con entre 10 y 10000 caracteres.',
      )
      return
    }

    if (!recoveryConfirmed) {
      setErrorMessage(
        'Confirma que comprobaste la recuperación del servicio.',
      )
      return
    }

    submissionInProgress.current = true
    setIsSubmitting(true)
    setErrorMessage('')

    let updatedIncident: Incident

    try {
      updatedIncident = await resolveIncident(
        accessToken,
        incidentId,
        { resolution_summary: cleanedSummary },
      )
    } catch (error: unknown) {
      if (!isMounted.current) return

      if (
        error instanceof IncidentsApiError &&
        error.status === 401
      ) {
        onSessionExpired()
        return
      }

      if (error instanceof IncidentsApiError) {
        setErrorMessage(error.message)
        setRequiresRefresh(error.status !== 422)
      } else {
        setRequiresRefresh(true)
        setErrorMessage(
          'No se pudo confirmar la resolución. Cierra y vuelve a abrir el detalle antes de reintentar.',
        )
      }

      return
    } finally {
      submissionInProgress.current = false

      if (isMounted.current) {
        setIsSubmitting(false)
      }
    }

    if (!isMounted.current) return

    setIsResolved(true)
    onIncidentResolved(updatedIncident)
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      aria-busy={isSubmitting}
    >
      <fieldset
        disabled={isSubmitting || requiresRefresh || isResolved}
      >
        <legend>Solución aplicada y recuperación</legend>

        <div className="form-field">
          <label htmlFor={summaryId}>
            Describe la solución aplicada
          </label>

          <textarea
            id={summaryId}
            name="resolution_summary"
            rows={6}
            required
            minLength={10}
            maxLength={10_000}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            aria-describedby={
              errorMessage ? `${helpId} ${errorId}` : helpId
            }
          />

          <p id={helpId} className="page-description">
            Explica qué realizaste y cómo comprobaste que
            el servicio volvió a funcionar.
          </p>
        </div>

        <div className="form-field">
          <label htmlFor={confirmationId}>
            <input
              id={confirmationId}
              type="checkbox"
              required
              checked={recoveryConfirmed}
              onChange={(event) =>
                setRecoveryConfirmed(event.target.checked)
              }
            />
            {' '}
            Confirmo que comprobé la recuperación del servicio.
          </label>
        </div>

        <p className="page-description">
          La incidencia quedará Resuelta, pendiente de confirmación.
          El colaborador deberá confirmar el cierre.
        </p>

        <button type="submit" className="primary-button">
          {isSubmitting
            ? 'Registrando solución…'
            : isResolved
              ? 'Solución registrada'
              : 'Registrar solución y recuperación'}
        </button>
      </fieldset>

      {errorMessage && (
        <p id={errorId} className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {requiresRefresh && (
        <p className="page-description">
          Cierra el detalle y vuelve a abrirlo para consultar
          el estado actualizado.
        </p>
      )}
    </form>
  )
}