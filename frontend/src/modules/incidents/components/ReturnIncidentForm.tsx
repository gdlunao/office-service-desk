import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './ReturnIncidentForm.css'
import {
  IncidentsApiError,
  returnIncident,
} from '../api/incidents.api'
import type { Incident } from '../types/incident.types'

interface ReturnIncidentFormProps {
  accessToken: string
  incidentId: number
  onIncidentReturned: (incident: Incident) => void
  onSessionExpired: () => void
}

export function ReturnIncidentForm({
  accessToken,
  incidentId,
  onIncidentReturned,
  onSessionExpired,
}: ReturnIncidentFormProps) {
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const submissionInProgress = useRef(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submissionInProgress.current) return

    const cleanedReason = reason.trim()

    if (cleanedReason.length < 10 || cleanedReason.length > 2000) {
      setErrorMessage(
        'Escribe un motivo de entre 10 y 2000 caracteres.',
      )
      return
    }

    submissionInProgress.current = true
    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const updatedIncident = await returnIncident(
        accessToken,
        incidentId,
        { reason: cleanedReason },
      )

      onIncidentReturned(updatedIncident)
    } catch (error: unknown) {
      if (
        error instanceof IncidentsApiError &&
        error.status === 401
      ) {
        onSessionExpired()
        return
      }

      setErrorMessage(
        error instanceof IncidentsApiError
          ? error.message
          : 'No se pudo confirmar la devolución. Actualiza el detalle antes de reintentar.',
      )
    } finally {
      submissionInProgress.current = false
      setIsSubmitting(false)
    }
  }

  const reasonId = `return-reason-${incidentId}`
  const helpId = `return-help-${incidentId}`

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={isSubmitting}
    >
      <fieldset disabled={isSubmitting}>
        <legend>El problema persiste</legend>

        <label htmlFor={reasonId}>
          Motivo de la devolución
        </label>

        <textarea
          id={reasonId}
          name="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minLength={10}
          maxLength={2000}
          rows={5}
          required
          aria-describedby={helpId}
        />

        <p id={helpId} className="page-description">
          Explica qué sigue fallando y cómo lo comprobaste.
          La incidencia regresará al técnico asignado.
          <form
            className="return-incident-form"
            onSubmit={handleSubmit}
            aria-busy={isSubmitting}
            ></form>
        </p>

        {errorMessage && (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        )}

        {isSubmitting && (
          <p role="status">Registrando devolución…</p>
        )}

        <button
          type="submit"
          className="secondary-button"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? 'Registrando…'
            : 'Devolver a atención'}
        </button>
      </fieldset>
    </form>
  )
}