import { useEffect, useId, useRef, useState } from 'react'

import {
  requestIncidentKnowledgeAssistance,
} from '../api/knowledge-assistance.api'
import {
  KnowledgeRecommendationsApiError,
} from '../api/recommendations.api'
import type {
  IncidentKnowledgeAssistance,
} from '../types/knowledge-assistance.types'
import { KnowledgeArticleDetail } from './KnowledgeArticleDetail'

import './KnowledgeAssistancePanel.css'

interface KnowledgeAssistancePanelProps {
  accessToken: string
  incidentId: number
  onSessionExpired: () => void
}

export function KnowledgeAssistancePanel({
  accessToken,
  incidentId,
  onSessionExpired,
}: KnowledgeAssistancePanelProps) {
  const panelId = useId()

  const [assistance, setAssistance] =
    useState<IncidentKnowledgeAssistance | null>(null)
  const [isRequesting, setIsRequesting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedArticleId, setSelectedArticleId] =
    useState<number | null>(null)

  const requestController =
    useRef<AbortController | null>(null)

  useEffect(() => {
    setAssistance(null)
    setErrorMessage('')
    setSelectedArticleId(null)
    setIsRequesting(false)

    return () => {
      requestController.current?.abort()
      requestController.current = null
    }
  }, [accessToken, incidentId])

  async function handleRequest() {
    if (requestController.current !== null) return

    const controller = new AbortController()
    requestController.current = controller

    let timedOut = false

    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 30_000)

    setIsRequesting(true)
    setErrorMessage('')
    setAssistance(null)
    setSelectedArticleId(null)

    try {
      const result =
        await requestIncidentKnowledgeAssistance(
          accessToken,
          incidentId,
          controller.signal,
        )

      if (
        controller.signal.aborted ||
        requestController.current !== controller
      ) {
        return
      }

      setAssistance(result)
    } catch (error: unknown) {
      if (requestController.current !== controller) return

      if (
        error instanceof KnowledgeRecommendationsApiError &&
        error.status === 401
      ) {
        onSessionExpired()
        return
      }

      setErrorMessage(
        timedOut
          ? 'La consulta tardó demasiado. Puedes continuar revisando los artículos publicados.'
          : error instanceof KnowledgeRecommendationsApiError
            ? error.message
            : 'No se pudo consultar la orientación. Comprueba la conexión o continúa con la atención manual.',
      )
    } finally {
      window.clearTimeout(timeoutId)

      if (requestController.current === controller) {
        requestController.current = null
        setIsRequesting(false)
      }
    }
  }

  return (
    <section
      className="knowledge-assistance-panel"
      aria-labelledby={`${panelId}-heading`}
    >
      <div className="section-heading">
        <div>
          <h3 id={`${panelId}-heading`}>
            Orientación técnica con IA
          </h3>

          <p className="page-description">
            Consulta comprobaciones sugeridas a partir de
            artículos publicados. Revisa las fuentes y decide
            cuáles corresponden a esta incidencia.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={isRequesting}
          onClick={() => void handleRequest()}
        >
          {isRequesting
            ? 'Consultando IA…'
            : assistance
              ? 'Volver a consultar orientación'
              : 'Solicitar orientación con IA'}
        </button>
      </div>

      <div aria-busy={isRequesting}>
        {isRequesting && (
          <p role="status">
            Preparando orientación con las fuentes disponibles…
          </p>
        )}

        {errorMessage && (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        )}

        {assistance && (
          <div className="knowledge-assistance-result">
            <p
              className="knowledge-assistance-notice"
              role="status"
            >
              Orientación pendiente de revisión. Las acciones
              sugeridas no se han ejecutado y no confirman
              que la incidencia esté resuelta.
            </p>

            <h4>Relación con el problema</h4>

            <p className="knowledge-assistance-text">
              {assistance.explanation}
            </p>

            <h4>Comprobaciones sugeridas</h4>

            <ol className="knowledge-assistance-checks">
              {assistance.suggested_checks.map(
                (check, index) => (
                  <li key={`${index}-${check}`}>
                    {check}
                  </li>
                ),
              )}
            </ol>

            <h4>Fuentes consultadas</h4>

            <ul className="knowledge-assistance-sources">
              {assistance.sources.map((source) => (
                <li key={source.article_id}>
                  <strong>{source.title}</strong>

                  <button
                    type="button"
                    className="secondary-button"
                    aria-label={
                      `Abrir fuente: ${source.title}`
                    }
                    aria-expanded={
                      selectedArticleId === source.article_id
                    }
                    aria-controls={
                      selectedArticleId === source.article_id
                        ? `${panelId}-source`
                        : undefined
                    }
                    onClick={() =>
                      setSelectedArticleId(source.article_id)
                    }
                  >
                    Ver fuente publicada
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {selectedArticleId !== null && (
        <div
          id={`${panelId}-source`}
          className="knowledge-assistance-source-detail"
        >
          <KnowledgeArticleDetail
            key={selectedArticleId}
            accessToken={accessToken}
            articleId={selectedArticleId}
            onClose={() => setSelectedArticleId(null)}
            onSessionExpired={onSessionExpired}
          />
        </div>
      )}
    </section>
  )
}