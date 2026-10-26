import { useEffect, useId, useState } from 'react'

import {
  getIncidentKnowledgeRecommendations,
  KnowledgeRecommendationsApiError,
} from '../api/recommendations.api'
import type {
  IncidentKnowledgeRecommendations,
} from '../types/recommendation.types'
import { KnowledgeArticleDetail } from './KnowledgeArticleDetail'

import './KnowledgeRecommendationsPanel.css'

interface KnowledgeRecommendationsPanelProps {
  accessToken: string
  incidentId: number
  onSessionExpired: () => void
}

export function KnowledgeRecommendationsPanel({
  accessToken,
  incidentId,
  onSessionExpired,
}: KnowledgeRecommendationsPanelProps) {
  const panelId = useId()

  const [result, setResult] =
    useState<IncidentKnowledgeRecommendations | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedArticleId, setSelectedArticleId] =
    useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true
    let timedOut = false

    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 15_000)

    async function loadRecommendations() {
      setIsLoading(true)
      setErrorMessage('')
      setResult(null)
      setSelectedArticleId(null)

      try {
        const response =
          await getIncidentKnowledgeRecommendations(
            accessToken,
            incidentId,
            controller.signal,
          )

        if (isActive) {
          setResult(response)
        }
      } catch (error: unknown) {
        if (!isActive) return

        if (
          error instanceof KnowledgeRecommendationsApiError &&
          error.status === 401
        ) {
          onSessionExpired()
          return
        }

        setErrorMessage(
          timedOut
            ? 'La consulta tardó demasiado. Puedes reintentar.'
            : error instanceof KnowledgeRecommendationsApiError
              ? error.message
              : 'No se pudieron consultar los artículos. Comprueba la conexión.',
        )
      } finally {
        window.clearTimeout(timeoutId)

        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadRecommendations()

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [
    accessToken,
    incidentId,
    reloadKey,
    onSessionExpired,
  ])

  return (
    <section
      className="knowledge-recommendations-panel"
      aria-labelledby={`${panelId}-heading`}
    >
      <div className="section-heading">
        <div>
          <h3 id={`${panelId}-heading`}>
            Artículos relacionados
          </h3>

          <p className="page-description">
            Soluciones publicadas que comparten palabras con
            esta incidencia. Revisa si corresponden al problema
            antes de aplicarlas.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={isLoading}
          onClick={() =>
            setReloadKey((value) => value + 1)
          }
        >
          Actualizar artículos
        </button>
      </div>

      <div aria-busy={isLoading}>
        {isLoading ? (
          <p role="status">
            Buscando artículos relacionados…
          </p>
        ) : errorMessage ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : result ? (
          result.recommendations.length === 0 ? (
            <p role="status">
              No se encontraron artículos publicados
              relacionados. Puedes continuar con la atención
              y consultar la base de conocimiento.
            </p>
          ) : (
            <ul className="knowledge-recommendations-list">
              {result.recommendations.map((item) => (
                <li
                  key={item.article_id}
                  className="knowledge-recommendation-card"
                >
                  <h4>{item.title}</h4>

                  <p className="knowledge-recommendation-summary">
                    {item.problem_summary}
                  </p>

                  <p className="page-description">
                    Palabras coincidentes:{' '}
                    {item.matched_keywords.join(', ')}
                  </p>

                  <button
                    type="button"
                    className="secondary-button"
                    aria-expanded={
                      selectedArticleId === item.article_id
                    }
                    aria-controls={
                      selectedArticleId === item.article_id
                        ? `${panelId}-article`
                        : undefined
                    }
                    onClick={() =>
                      setSelectedArticleId(item.article_id)
                    }
                  >
                    Ver solución publicada
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>

      {selectedArticleId !== null && (
        <div
          id={`${panelId}-article`}
          className="knowledge-recommendation-detail"
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