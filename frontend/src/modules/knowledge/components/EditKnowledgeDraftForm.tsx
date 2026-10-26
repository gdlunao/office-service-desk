import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import {
  KnowledgeApiError,
  updateKnowledgeDraft,
} from '../api/knowledge.api'
import type {
  KnowledgeArticle,
  KnowledgeArticleDraftUpdate,
} from '../types/knowledge.types'

import './EditKnowledgeDraftForm.css'

interface EditKnowledgeDraftFormProps {
  accessToken: string
  article: KnowledgeArticle
  onSaved: (article: KnowledgeArticle) => void
  onCancel: () => void
  onSessionExpired: () => void
}

interface DraftField {
  key: keyof KnowledgeArticleDraftUpdate
  label: string
  minLength: number
  maxLength: number
}

const FIELDS: DraftField[] = [
  {
    key: 'title',
    label: 'Título',
    minLength: 5,
    maxLength: 200,
  },
  {
    key: 'problem_summary',
    label: 'Problema',
    minLength: 10,
    maxLength: 10_000,
  },
  {
    key: 'solution_description',
    label: 'Solución documentada',
    minLength: 10,
    maxLength: 10_000,
  },
  {
    key: 'technical_actions',
    label: 'Acciones técnicas',
    minLength: 10,
    maxLength: 10_000,
  },
  {
    key: 'recovery_evidence',
    label: 'Evidencia de recuperación',
    minLength: 10,
    maxLength: 10_000,
  },
]

export function EditKnowledgeDraftForm({
  accessToken,
  article,
  onSaved,
  onCancel,
  onSessionExpired,
}: EditKnowledgeDraftFormProps) {
  const formId = useId()
  const isActive = useRef(false)
  const submissionInProgress = useRef(false)

  const [values, setValues] =
    useState<KnowledgeArticleDraftUpdate>({
      title: article.title,
      problem_summary: article.problem_summary,
      solution_description: article.solution_description,
      technical_actions: article.technical_actions,
      recovery_evidence: article.recovery_evidence,
    })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasSaved, setHasSaved] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    isActive.current = true

    return () => {
      isActive.current = false
    }
  }, [])

  function updateField(
    key: keyof KnowledgeArticleDraftUpdate,
    value: string,
  ) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }))
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      submissionInProgress.current ||
      hasSaved ||
      article.status !== 'draft'
    ) {
      return
    }

    const data: KnowledgeArticleDraftUpdate = {
      title: values.title.trim(),
      problem_summary: values.problem_summary.trim(),
      solution_description: values.solution_description.trim(),
      technical_actions: values.technical_actions.trim(),
      recovery_evidence: values.recovery_evidence.trim(),
    }

    for (const field of FIELDS) {
      const length = data[field.key].length

      if (
        length < field.minLength ||
        length > field.maxLength
      ) {
        setErrorMessage(
          `${field.label} debe tener entre ${field.minLength} y ${field.maxLength} caracteres.`,
        )
        return
      }
    }

    submissionInProgress.current = true
    setIsSubmitting(true)
    setErrorMessage('')

    let updatedArticle: KnowledgeArticle | null = null

    try {
      updatedArticle = await updateKnowledgeDraft(
        accessToken,
        article.id,
        data,
      )

      if (isActive.current) {
        setHasSaved(true)
      }
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
          : 'No se pudo confirmar el guardado. Actualiza el artículo antes de reintentar.',
      )
    } finally {
      submissionInProgress.current = false

      if (isActive.current) {
        setIsSubmitting(false)
      }
    }

    if (updatedArticle && isActive.current) {
      onSaved(updatedArticle)
    }
  }

  return (
    <form
      className="knowledge-draft-form"
      onSubmit={(event) => void handleSubmit(event)}
      aria-busy={isSubmitting}
    >
      <fieldset
        disabled={
          isSubmitting ||
          hasSaved ||
          article.status !== 'draft'
        }
      >
        <legend>Editar borrador</legend>

        <p className="page-description">
          Revisa los cinco apartados. Guardar los cambios
          conserva el artículo como borrador.
        </p>

        {FIELDS.map((field) => {
          const inputId = `${formId}-${field.key}`

          return (
            <div
              key={field.key}
              className="knowledge-draft-field"
            >
              <label htmlFor={inputId}>{field.label}</label>

              {field.key === 'title' ? (
                <input
                  id={inputId}
                  type="text"
                  value={values[field.key]}
                  required
                  minLength={field.minLength}
                  maxLength={field.maxLength}
                  onChange={(event) =>
                    updateField(field.key, event.target.value)
                  }
                />
              ) : (
                <textarea
                  id={inputId}
                  value={values[field.key]}
                  rows={5}
                  required
                  minLength={field.minLength}
                  maxLength={field.maxLength}
                  onChange={(event) =>
                    updateField(field.key, event.target.value)
                  }
                />
              )}
            </div>
          )
        })}

        <div className="section-actions">
          <button
            type="submit"
            className="secondary-button"
          >
            {isSubmitting
              ? 'Guardando…'
              : hasSaved
                ? 'Cambios guardados'
                : 'Guardar cambios'}
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      </fieldset>

      {errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}
    </form>
  )
}