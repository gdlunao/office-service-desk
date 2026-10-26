import { useEffect, useId, useState } from 'react'

import {
  getKnowledgeArticle,
  KnowledgeApiError,
} from '../api/knowledge.api'
import {
  KNOWLEDGE_STATUS_LABELS,
} from '../types/knowledge.types'
import type {
  KnowledgeArticle,
} from '../types/knowledge.types'
import { EditKnowledgeDraftForm } from './EditKnowledgeDraftForm'
import { PublishKnowledgeArticleButton } from './PublishKnowledgeArticleButton'
import './KnowledgeArticleDetail.css'

interface KnowledgeArticleDetailProps {
  accessToken: string
  articleId: number
  onClose: () => void
  onSessionExpired: () => void
  canPublish?: boolean
  onArticleUpdated?: (article: KnowledgeArticle) => void
}

export function KnowledgeArticleDetail({
  accessToken,
  articleId,
  canPublish = false,
  onClose,
  onSessionExpired,
  onArticleUpdated,
}: KnowledgeArticleDetailProps) {
  const headingId = useId()

  const [article, setArticle] =
    useState<KnowledgeArticle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true
    let timedOut = false

    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 15_000)

    async function loadArticle() {
      setIsLoading(true)
      setErrorMessage('')
      setArticle(null)
      setIsEditing(false)
      setSuccessMessage('')

      try {
        const result = await getKnowledgeArticle(
          accessToken,
          articleId,
          controller.signal,
        )

        if (isActive) {
          setArticle(result)
        }
      } catch (error: unknown) {
        if (!isActive) return

        if (
          error instanceof KnowledgeApiError &&
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
                : 'No se pudo cargar el artículo.',
        )
      } finally {
        window.clearTimeout(timeoutId)

        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadArticle()

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [
    accessToken,
    articleId,
    reloadKey,
    onSessionExpired,
  ])

  function handleDraftSaved(updatedArticle: KnowledgeArticle) {
    setArticle(updatedArticle)
    setIsEditing(false)
    setSuccessMessage(
      'Los cambios se guardaron. El artículo continúa como borrador.',
    )

    onArticleUpdated?.(updatedArticle)
  }

  function handleArticlePublished(
    publishedArticle: KnowledgeArticle,
  ) {
    setArticle(publishedArticle)
    setIsEditing(false)
    setSuccessMessage(
      'El artículo se publicó y está disponible para las cuentas técnicas.',
    )

    onArticleUpdated?.(publishedArticle)
  }
  return (
    <article
      className="knowledge-article-detail"
      aria-labelledby={headingId}
    >
      <div className="section-heading">
        <h2 id={headingId}>Detalle del artículo</h2>

        <button
          type="button"
          className="secondary-button"
          onClick={onClose}
        >
          Cerrar artículo
        </button>
      </div>

      <div aria-busy={isLoading}>
        {isLoading ? (
          <p role="status">Cargando artículo…</p>
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
        ) : article ? (
          <>
            <h3 className="knowledge-article-title">
              {article.title}
            </h3>

            <p className="page-description">
              Estado:{' '}
              {KNOWLEDGE_STATUS_LABELS[article.status] ??
                'Estado desconocido'}
            </p>

            {successMessage && (
              <p role="status">{successMessage}</p>
            )}

            {article.status === 'draft' && !isEditing && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSuccessMessage('')
                  setIsEditing(true)
                }}
              >
                Editar borrador
              </button>
            )}

            {article.status === 'draft' && isEditing && (
              <EditKnowledgeDraftForm
                key={`${article.id}-${article.updated_at}`}
                accessToken={accessToken}
                article={article}
                onSaved={handleDraftSaved}
                onCancel={() => setIsEditing(false)}
                onSessionExpired={onSessionExpired}
              />
            )}
            {canPublish &&
              article.status === 'draft' &&
              !isEditing && (
                <PublishKnowledgeArticleButton
                  key={article.id}
                  accessToken={accessToken}
                  articleId={article.id}
                  onPublished={handleArticlePublished}
                  onSessionExpired={onSessionExpired}
                />
              )}

            <div className="knowledge-article-sections">
              <section>
                <h3>Problema</h3>
                <p>{article.problem_summary}</p>
              </section>

              <section>
                <h3>Solución documentada</h3>
                <p>{article.solution_description}</p>
              </section>

              <section>
                <h3>Acciones técnicas</h3>
                <p>{article.technical_actions}</p>
              </section>

              <section>
                <h3>Evidencia de recuperación</h3>
                <p>{article.recovery_evidence}</p>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </article>
  )
}