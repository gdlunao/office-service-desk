import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import {
  closeIncident,
  IncidentsApiError,
} from '../api/incidents.api'
import type { Incident } from '../types/incident.types'

interface CloseIncidentFormProps {
  accessToken: string
  incidentId: number
  onIncidentClosed: (incident: Incident) => void
  onSessionExpired: () => void
}

export function CloseIncidentForm({
  accessToken,
  incidentId,
  onIncidentClosed,
  onSessionExpired,
}: CloseIncidentFormProps) {
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [requiresRefresh, setRequiresRefresh] = useState(false)
  const [isClosed, setIsClosed] = useState(false)

  const isMounted = useRef(false)
  const submissionInProgress = useRef(false)

  const confirmationId = `close-confirmation-${incidentId}`

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
      isClosed
    ) {
      return
    }

    if (!isConfirmed) {
      setErrorMessage(
        'Confirma que el servicio funciona correctamente.',
      )
      return
    }

    submissionInProgress.current = true
    setIsSubmitting(true)
    setErrorMessage('')

    let updatedIncident: Incident

    try {
      updatedIncident = await closeIncident(
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
          : 'No se pudo confirmar el cierre. Cierra y vuelve a abrir el detalle antes de reintentar.',
      )

      return
    } finally {
      submissionInProgress.current = false

      if (isMounted.current) {
        setIsSubmitting(false)
      }
    }

    if (!isMounted.current) return

    setIsClosed(true)
    onIncidentClosed(updatedIncident)
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      aria-busy={isSubmitting}
    >
      <fieldset
        disabled={isSubmitting || requiresRefresh || isClosed}
      >
        <legend>Confirmación del reportante</legend>

        <p className="page-description">
          Revisa la solución aplicada y comprueba que puedes
          utilizar el servicio correctamente antes de cerrar
          la incidencia.
        </p>

        <div className="form-field">
          <label htmlFor={confirmationId}>
            <input
              id={confirmationId}
              type="checkbox"
              required
              checked={isConfirmed}
              onChange={(event) =>
                setIsConfirmed(event.target.checked)
              }
            />
            {' '}
            Confirmo que el servicio funciona correctamente
            y acepto el cierre de esta incidencia.
          </label>
        </div>

        <button type="submit" className="primary-button">
          {isSubmitting
            ? 'Confirmando cierre…'
            : isClosed
              ? 'Cierre confirmado'
              : 'Confirmar cierre'}
        </button>
      </fieldset>

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
    </form>
  )
}