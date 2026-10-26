import { useEffect, useId, useState } from 'react'

import {
  getLatestSolutionAttempt,
  SolutionAttemptsApiError,
} from '../api/solution-attempts.api'
import type {
  SolutionAttempt,
} from '../types/solution-attempt.types'
import { FinishSolutionAttemptForm } from './FinishSolutionAttemptForm'
import { StartSolutionAttemptForm } from './StartSolutionAttemptForm'

interface SolutionAttemptActionsProps {
  accessToken: string
  incidentId: number
  onAttemptChanged: () => void
  onSessionExpired: () => void
}

export function SolutionAttemptActions({
  accessToken,
  incidentId,
  onAttemptChanged,
  onSessionExpired,
}: SolutionAttemptActionsProps) {
  const headingId = useId()

  const [latestAttempt, setLatestAttempt] =
    useState<SolutionAttempt | null>(null)
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

    async function loadLatestAttempt() {
      setIsLoading(true)
      setErrorMessage('')
      setLatestAttempt(null)

      try {
        const result = await getLatestSolutionAttempt(
          accessToken,
          incidentId,
          controller.signal,
        )

        if (isActive) {
          setLatestAttempt(result)
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
            ? 'El servidor tardó demasiado. Actualiza el detalle.'
            : error instanceof TypeError
              ? 'No se pudo conectar con el servidor.'
              : error instanceof Error
                ? error.message
                : 'No se pudo consultar el último intento.',
        )
      } finally {
        window.clearTimeout(timeoutId)

        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadLatestAttempt()

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [
    accessToken,
    incidentId,
    onSessionExpired,
  ])

  const canStartAttempt =
    latestAttempt === null ||
    latestAttempt.status === 'failed' ||
    latestAttempt.status === 'returned'

  return (
    <section
      className="incident-assignment-panel"
      aria-labelledby={headingId}
    >
      <div className="section-heading">
        <div>
          <h3 id={headingId}>
            Atención por intentos de solución
          </h3>

          <p className="page-description">
            Registra cada solución que apliques y conserva
            el resultado de los intentos anteriores.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={isLoading}
          onClick={onAttemptChanged}
        >
          Actualizar detalle
        </button>
      </div>

      <div aria-busy={isLoading}>
        {isLoading ? (
          <p role="status">Consultando el último intento…</p>
        ) : errorMessage ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : canStartAttempt ? (
          <>
            <p className="page-description">
              {latestAttempt === null
                ? 'Todavía no hay intentos registrados. Puedes iniciar la primera solución.'
                : `Puedes iniciar una nueva solución. El último intento registrado es el ${latestAttempt.attempt_number}.`}
            </p>

            <StartSolutionAttemptForm
              key={`${incidentId}-${latestAttempt?.id ?? 'first'}`}
              accessToken={accessToken}
              incidentId={incidentId}
              onAttemptStarted={() => onAttemptChanged()}
              onSessionExpired={onSessionExpired}
            />
          </>
        ) : latestAttempt?.status === 'in_progress' ? (
          <FinishSolutionAttemptForm
            key={latestAttempt.id}
            accessToken={accessToken}
            attempt={latestAttempt}
            onAttemptFinished={() => onAttemptChanged()}
            onSessionExpired={onSessionExpired}
          />
        ) : (
          <p role="status">
            Ya existe una recuperación registrada. Actualiza
            el detalle para consultar el estado de la incidencia.
          </p>
        )}
      </div>
    </section>
  )
}