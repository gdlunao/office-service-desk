import { useEffect, useId, useState } from 'react'

import {
  listSolutionAttempts,
  SolutionAttemptsApiError,
} from '../api/solution-attempts.api'
import {
  SOLUTION_ATTEMPT_STATUS_LABELS,
} from '../types/solution-attempt.types'
import type {
  SolutionAttempt,
} from '../types/solution-attempt.types'

import './SolutionAttemptsPanel.css'

interface SolutionAttemptsPanelProps {
  accessToken: string
  incidentId: number
  onSessionExpired: () => void
}

const PAGE_SIZE = 20

const dateFormatter = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Lima',
})

function formatDate(value: string | null): string {
  if (!value) return 'No registrada'

  // El backend entrega las fechas UTC sin sufijo de zona horaria.
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
  const date = new Date(hasTimezone ? value : `${value}Z`)

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible'
  }

  return dateFormatter.format(date)
}

export function SolutionAttemptsPanel({
  accessToken,
  incidentId,
  onSessionExpired,
}: SolutionAttemptsPanelProps) {
  const headingId = useId()

  const [attempts, setAttempts] = useState<SolutionAttempt[]>([])
  const [offset, setOffset] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true
    let timedOut = false

    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 15_000)

    async function loadAttempts() {
      setIsLoading(true)
      setErrorMessage('')
      setAttempts([])

      try {
        const result = await listSolutionAttempts(
          accessToken,
          incidentId,
          offset,
          PAGE_SIZE,
          controller.signal,
        )

        if (isActive) {
          setAttempts(result)
        }
      } catch (error: unknown) {
        if (!isActive) return

        if (
          error instanceof SolutionAttemptsApiError &&
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
                : 'No se pudieron cargar los intentos.',
        )
      } finally {
        window.clearTimeout(timeoutId)

        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadAttempts()

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
    setReloadKey((value) => value + 1)
  }

  return (
    <section
      className="solution-attempts-panel"
      aria-labelledby={headingId}
    >
      <div className="section-heading">
        <div>
          <h3 id={headingId}>Intentos de solución</h3>
          <p className="page-description">
            Consulta las soluciones aplicadas y sus resultados.
            Las fechas se muestran en hora de Perú.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={isLoading}
          onClick={handleRefresh}
        >
          Actualizar intentos
        </button>
      </div>

      <div aria-busy={isLoading}>
        {isLoading ? (
          <p role="status">Cargando intentos…</p>
        ) : errorMessage ? (
          <div>
            <p className="form-error" role="alert">
              {errorMessage}
            </p>

            <button
              type="button"
              className="secondary-button"
              onClick={handleRefresh}
            >
              Reintentar
            </button>
          </div>
        ) : attempts.length === 0 ? (
          <p>
            {offset === 0
              ? 'Todavía no hay intentos de solución registrados.'
              : 'No hay intentos en esta página.'}
          </p>
        ) : (
          <ol className="solution-attempts-list">
            {attempts.map((attempt) => (
              <li key={attempt.id}>
                <article className="solution-attempt-card">
                  <header className="solution-attempt-header">
                    <h4>Intento {attempt.attempt_number}</h4>

                    <span
                      className="solution-attempt-status"
                      data-status={attempt.status}
                    >
                      {SOLUTION_ATTEMPT_STATUS_LABELS[
                        attempt.status
                      ] ?? 'Estado desconocido'}
                    </span>
                  </header>

                  <dl className="solution-attempt-metadata">
                    <div>
                      <dt>Técnico</dt>
                      <dd>{attempt.technician_name}</dd>
                    </div>

                    <div>
                      <dt>Inicio del intento</dt>
                      <dd>{formatDate(attempt.started_at)}</dd>
                    </div>

                    <div>
                      <dt>Finalización</dt>
                      <dd>{formatDate(attempt.finished_at)}</dd>
                    </div>

                    {attempt.returned_at && (
                      <div>
                        <dt>Devolución</dt>
                        <dd>{formatDate(attempt.returned_at)}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="solution-attempt-section">
                    <h5>Solución propuesta o aplicada</h5>
                    <p>
                      {attempt.solution_description ??
                        'Sin descripción registrada.'}
                    </p>
                  </div>

                  <div className="solution-attempt-section">
                    <h5>Acciones técnicas</h5>
                    <p>
                      {attempt.technical_actions ??
                        'Todavía no se han registrado acciones.'}
                    </p>
                  </div>

                  <div className="solution-attempt-section">
                    <h5>Evidencia de recuperación</h5>
                    <p>
                      {attempt.recovery_evidence ??
                        'Sin evidencia de recuperación registrada.'}
                    </p>
                  </div>

                  {attempt.return_reason && (
                    <div
                      className={
                        'solution-attempt-section ' +
                        'solution-attempt-return'
                      }
                    >
                      <h5>Motivo de devolución</h5>
                      <p>{attempt.return_reason}</p>
                    </div>
                  )}
                </article>
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
            attempts.length < PAGE_SIZE
          }
          onClick={() => setOffset((value) => value + PAGE_SIZE)}
        >
          Siguiente
        </button>
      </div>
    </section>
  )
}