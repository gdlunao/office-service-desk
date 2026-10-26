import { useEffect, useId, useState } from 'react'

import { listIncidentEvents } from '../api/incident-events.api'
import { IncidentsApiError } from '../api/incidents.api'
import { INCIDENT_EVENT_LABELS } from '../types/incident-event.types'
import type { IncidentEvent } from '../types/incident-event.types'
import { INCIDENT_STATUS_LABELS } from '../types/incident.types'

import './IncidentHistory.css'

interface IncidentHistoryProps {
  accessToken: string
  incidentId: number
  onSessionExpired: () => void
}

const PAGE_SIZE = 20

const dateFormatter = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'medium',
  timeZone: 'America/Lima',
})

function formatEventDate(value: string): string {
  // El backend actual devuelve las fechas en UTC sin sufijo.
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    ? value
    : `${value}Z`

  const date = new Date(normalized)

  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : dateFormatter.format(date)
}

export function IncidentHistory({
  accessToken,
  incidentId,
  onSessionExpired,
}: IncidentHistoryProps) {
  const headingId = useId()

  const [events, setEvents] = useState<IncidentEvent[]>([])
  const [offset, setOffset] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true
    let timedOut = false

    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 15_000)

    async function loadHistory() {
      setIsLoading(true)
      setErrorMessage('')
      setEvents([])

      try {
        const result = await listIncidentEvents(
          accessToken,
          incidentId,
          offset,
          PAGE_SIZE,
          controller.signal,
        )

        if (isActive) {
          setEvents(result)
        }
      } catch (error: unknown) {
        if (!isActive) return

        if (
          error instanceof IncidentsApiError &&
          error.status === 401
        ) {
          onSessionExpired()
          return
        }

        setErrorMessage(
          timedOut
            ? 'El servidor tardó demasiado. Puedes reintentar.'
            : error instanceof TypeError
              ? 'No se pudo conectar con el servidor.'
              : error instanceof Error
                ? error.message
                : 'No se pudo cargar el historial.',
        )
      } finally {
        window.clearTimeout(timeoutId)

        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadHistory()

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [
    accessToken,
    incidentId,
    offset,
    reloadKey,
    onSessionExpired,
  ])

  function handleRefresh() {
    setOffset(0)
    setReloadKey((value) => value + 1)
  }

  return (
    <section
      className="incident-history"
      aria-labelledby={headingId}
    >
      <div className="section-heading">
        <div>
          <h3 id={headingId}>Historial de la incidencia</h3>
          <p className="page-description">
            Acciones registradas en orden cronológico.
            Horario de Lima.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={isLoading}
          onClick={handleRefresh}
        >
          Actualizar historial
        </button>
      </div>

      <div aria-busy={isLoading}>
        {isLoading ? (
          <p role="status">Cargando historial…</p>
        ) : errorMessage ? (
          <div>
            <p className="form-error" role="alert">
              {errorMessage}
            </p>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : events.length === 0 ? (
          <p>
            {offset === 0
              ? 'Esta incidencia todavía no tiene eventos registrados.'
              : 'No hay más eventos en esta página.'}
          </p>
        ) : (
          <ol
            className="incident-history-list"
            start={offset + 1}
          >
            {events.map((event) => (
              <li
                key={event.id}
                className="incident-history-item"
              >
                <strong>
                  {INCIDENT_EVENT_LABELS[event.event_type] ??
                    'Acción registrada'}
                </strong>

                <p className="incident-history-meta">
                  {formatEventDate(event.created_at)}
                  {' · '}
                  {event.actor_name || 'Nombre no disponible'}
                </p>

                <p>
                  {event.previous_status !== null
                    ? `${
                        INCIDENT_STATUS_LABELS[
                          event.previous_status
                        ] ?? 'Estado desconocido'
                      } → `
                    : 'Estado inicial: '}

                  {INCIDENT_STATUS_LABELS[event.new_status] ??
                    'Estado desconocido'}
                </p>

                {event.details && (
                  <p className="incident-history-details">
                    {event.details}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="pagination">
        <button
          type="button"
          className="secondary-button"
          disabled={isLoading || offset === 0}
          onClick={() =>
            setOffset((value) => Math.max(0, value - PAGE_SIZE))
          }
        >
          Anterior
        </button>

        <span>Página {offset / PAGE_SIZE + 1}</span>

        <button
          type="button"
          className="secondary-button"
          disabled={
            isLoading ||
            Boolean(errorMessage) ||
            events.length < PAGE_SIZE
          }
          onClick={() => setOffset((value) => value + PAGE_SIZE)}
        >
          Siguiente
        </button>
      </div>
    </section>
  )
}