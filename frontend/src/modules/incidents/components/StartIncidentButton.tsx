import { useEffect, useRef, useState } from 'react'

import {
  IncidentsApiError,
  startIncident,
} from '../api/incidents.api'
import type { Incident } from '../types/incident.types'

interface StartIncidentButtonProps {
  accessToken: string
  incidentId: number
  onIncidentStarted: (incident: Incident) => void
  onSessionExpired: () => void
}

export function StartIncidentButton({
  accessToken,
  incidentId,
  onIncidentStarted,
  onSessionExpired,
}: StartIncidentButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [requiresRefresh, setRequiresRefresh] = useState(false)
  const [isStarted, setIsStarted] = useState(false)

  const isMounted = useRef(false)
  const submissionInProgress = useRef(false)

  useEffect(() => {
    isMounted.current = true

    return () => {
      isMounted.current = false
    }
  }, [])

  async function handleStart() {
    if (
      submissionInProgress.current ||
      requiresRefresh ||
      isStarted
    ) {
      return
    }

    submissionInProgress.current = true
    setIsSubmitting(true)
    setErrorMessage('')

    let updatedIncident: Incident

    try {
      updatedIncident = await startIncident(
        accessToken,
        incidentId,
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

      setRequiresRefresh(true)

      setErrorMessage(
        error instanceof IncidentsApiError
          ? error.message
          : 'No se pudo confirmar el inicio. Actualiza el detalle antes de reintentar.',
      )

      return
    } finally {
      submissionInProgress.current = false

      if (isMounted.current) {
        setIsSubmitting(false)
      }
    }

    if (!isMounted.current) return

    setIsStarted(true)
    onIncidentStarted(updatedIncident)
  }

  return (
    <div
      className="incident-start-actions"
      aria-busy={isSubmitting}
    >
      <button
        type="button"
        className="primary-button"
        disabled={isSubmitting || requiresRefresh || isStarted}
        onClick={() => void handleStart()}
      >
        {isSubmitting
          ? 'Iniciando atención…'
          : isStarted
            ? 'Atención iniciada'
            : 'Iniciar atención'}
      </button>

      {errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {requiresRefresh && (
        <p className="page-description">
          Cierra el detalle y vuelve a abrirlo para consultar
          el estado actualizado.
        </p>
      )}
    </div>
  )
}