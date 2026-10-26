import { useEffect, useId, useRef, useState } from 'react'

import {
  createKnowledgeDraft,
  KnowledgeApiError,
} from '../api/knowledge.api'
import type {
  KnowledgeArticle,
} from '../types/knowledge.types'

interface CreateKnowledgeDraftButtonProps {
  accessToken: string
  incidentId: number
  onSessionExpired: () => void
}

export function CreateKnowledgeDraftButton({
  accessToken,
  incidentId,
  onSessionExpired,
}: CreateKnowledgeDraftButtonProps) {
  const headingId = useId()

  const isActive = useRef(false)
  const submissionInProgress = useRef(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [createdArticle, setCreatedArticle] =
    useState<KnowledgeArticle | null>(null)

  useEffect(() => {
    isActive.current = true

    return () => {
      isActive.current = false
    }
  }, [])

  async function handleCreateDraft() {
    if (
      submissionInProgress.current ||
      createdArticle !== null
    ) {
      return
    }

    submissionInProgress.current = true
    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const article = await createKnowledgeDraft(
        accessToken,
        { source_incident_id: incidentId },
      )

      if (!isActive.current) return

      setCreatedArticle(article)
    } catch (error: unknown) {
      if (!isActive.current) return

      if (
        error instanceof KnowledgeApiError &&
        error.status === 401
      ) {
        onSessionExpired()
        return
      }

      setErrorMessage(
        error instanceof KnowledgeApiError
          ? error.message
          : 'No se pudo confirmar la creación. Revisa los artículos antes de reintentar.',
      )
    } finally {
      submissionInProgress.current = false

      if (isActive.current) {
        setIsSubmitting(false)
      }
    }
  }

  return (
    <section
      className="incident-assignment-panel"
      aria-labelledby={headingId}
      aria-busy={isSubmitting}
    >
      <h3 id={headingId}>Conservar la solución como conocimiento</h3>

      <p className="page-description">
        Crea un borrador con el problema y la última solución
        recuperada de esta incidencia. El responsable TI deberá
        revisarlo antes de publicarlo.
      </p>

      <button
        type="button"
        className="secondary-button"
        disabled={isSubmitting || createdArticle !== null}
        onClick={() => void handleCreateDraft()}
      >
        {isSubmitting
          ? 'Creando borrador…'
          : createdArticle
            ? 'Borrador creado'
            : 'Crear borrador de conocimiento'}
      </button>

      {createdArticle && (
        <p role="status">
          Se creó el borrador #{createdArticle.id}:{' '}
          {createdArticle.title}. Todavía no está publicado.
        </p>
      )}

      {errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}
    </section>
  )
}