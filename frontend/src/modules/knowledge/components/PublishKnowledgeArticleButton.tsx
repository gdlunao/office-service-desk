import { useEffect, useRef, useState } from 'react'

import { useToast } from '../../../shared/feedback/toast-context'
import {
  KnowledgeApiError,
  publishKnowledgeArticle,
} from '../api/knowledge.api'
import type {
  KnowledgeArticle,
} from '../types/knowledge.types'

interface PublishKnowledgeArticleButtonProps {
  accessToken: string
  articleId: number
  onPublished: (article: KnowledgeArticle) => void
  onSessionExpired: () => void
}

export function PublishKnowledgeArticleButton({
  accessToken,
  articleId,
  onPublished,
  onSessionExpired,
}: PublishKnowledgeArticleButtonProps) {
  const { showToast } = useToast()

  const isActive = useRef(false)
  const submissionInProgress = useRef(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasPublished, setHasPublished] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    isActive.current = true

    return () => {
      isActive.current = false
    }
  }, [])

  async function handlePublish() {
    if (submissionInProgress.current || hasPublished) {
      return
    }

    submissionInProgress.current = true
    setIsSubmitting(true)
    setErrorMessage('')

    let publishedArticle: KnowledgeArticle

    try {
      publishedArticle = await publishKnowledgeArticle(
        accessToken,
        articleId,
      )
    } catch (error: unknown) {
      if (!isActive.current) return

      if (
        error instanceof KnowledgeApiError &&
        error.status === 401
      ) {
        onSessionExpired()
        return
      }

      const message =
        error instanceof KnowledgeApiError
          ? error.message
          : 'No se pudo confirmar la publicación. Actualiza el artículo antes de reintentar.'

      setErrorMessage(message)

      showToast({
        type: 'error',
        message,
      })

      return
    } finally {
      submissionInProgress.current = false

      if (isActive.current) {
        setIsSubmitting(false)
      }
    }

    if (!isActive.current) return

    setHasPublished(true)

    showToast({
      type: 'success',
      message:
        'Artículo publicado correctamente. Ya está disponible para las cuentas técnicas.',
    })

    onPublished(publishedArticle)
  }

  return (
    <div aria-busy={isSubmitting}>
      <p className="page-description">
        Publica el artículo después de revisar su contenido.
        Estará disponible para las cuentas técnicas.
      </p>

      <button
        type="button"
        className="secondary-button"
        disabled={isSubmitting || hasPublished}
        onClick={() => void handlePublish()}
      >
        {isSubmitting
          ? 'Publicando…'
          : hasPublished
            ? 'Artículo publicado'
            : 'Publicar artículo'}
      </button>

      {isSubmitting && (
        <p role="status">Publicando artículo…</p>
      )}

      {errorMessage && (
        <p className="form-error">
          {errorMessage}
        </p>
      )}
    </div>
  )
}