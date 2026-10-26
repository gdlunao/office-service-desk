import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import {
  createIncident,
  IncidentsApiError,
} from '../api/incidents.api'
import type { Incident } from '../types/incident.types'

interface CreateIncidentFormProps {
  accessToken: string
  onIncidentCreated: (incident: Incident) => void
  onSessionExpired: () => void
  onCancel?: () => void
}

export function CreateIncidentForm({
  accessToken,
  onIncidentCreated,
  onSessionExpired,
  onCancel,
}: CreateIncidentFormProps) {
  const formId = useId()
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const keepEditingRef = useRef<HTMLButtonElement>(null)
  const isActive = useRef(false)
  const submissionInProgress = useRef(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasSaved, setHasSaved] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [showDiscardConfirmation, setShowDiscardConfirmation] =
    useState(false)

  useEffect(() => {
    isActive.current = true

    return () => {
      isActive.current = false
    }
  }, [])

  useEffect(() => {
    if (showDiscardConfirmation) {
      keepEditingRef.current?.focus()
    }
  }, [showDiscardConfirmation])

  function handleCancel() {
    if (submissionInProgress.current || !onCancel) return

    if (!hasSaved && (title.length > 0 || description.length > 0)) {
      setShowDiscardConfirmation(true)
      return
    }

    onCancel()
  }

  function handleKeepEditing() {
    setShowDiscardConfirmation(false)
    cancelButtonRef.current?.focus()
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      submissionInProgress.current ||
      hasSaved ||
      showDiscardConfirmation
    ) {
      return
    }

    setErrorMessage('')
    setSuccessMessage('')

    const cleanTitle = title.trim()
    const cleanDescription = description.trim()

    if (cleanTitle.length < 5 || cleanTitle.length > 200) {
      setErrorMessage(
        'El título debe tener entre 5 y 200 caracteres.',
      )
      return
    }

    if (
      cleanDescription.length < 10 ||
      cleanDescription.length > 10_000
    ) {
      setErrorMessage(
        'La descripción debe tener entre 10 y 10 000 caracteres.',
      )
      return
    }

    submissionInProgress.current = true
    setIsSubmitting(true)

    let createdIncident: Incident

    try {
      createdIncident = await createIncident(accessToken, {
        title: cleanTitle,
        description: cleanDescription,
      })
    } catch (error: unknown) {
      if (!isActive.current) return

      if (
        error instanceof IncidentsApiError &&
        error.status === 401
      ) {
        onSessionExpired()
        return
      }

      setErrorMessage(
        error instanceof DOMException &&
          error.name === 'TimeoutError'
          ? 'La solicitud tardó demasiado. Revisa el listado antes de reenviar; el reporte podría haberse guardado.'
          : error instanceof TypeError
            ? 'No se pudo confirmar el registro por un problema de conexión. Revisa el listado antes de reenviar.'
            : error instanceof Error
              ? error.message
              : 'No se pudo confirmar el registro. Revisa el listado antes de reenviar.',
      )

      return
    } finally {
      submissionInProgress.current = false

      if (isActive.current) {
        setIsSubmitting(false)
      }
    }

    if (!isActive.current) return

    setHasSaved(true)
    setTitle('')
    setDescription('')
    setSuccessMessage(
      `La incidencia #${createdIncident.id} se registró correctamente.`,
    )

    onIncidentCreated(createdIncident)
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
      <fieldset
        className="login-fields"
        disabled={
          isSubmitting ||
          hasSaved ||
          showDiscardConfirmation
        }
      >
        <legend>Datos de la incidencia</legend>

        <label htmlFor={`${formId}-title`}>Título</label>

        <input
          id={`${formId}-title`}
          name="title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          minLength={5}
          maxLength={200}
          required
          placeholder="Ejemplo: Impresora sin conexión"
        />

        <label htmlFor={`${formId}-description`}>
          Descripción
        </label>

        <textarea
          id={`${formId}-description`}
          name="description"
          value={description}
          onChange={(event) =>
            setDescription(event.target.value)
          }
          minLength={10}
          maxLength={10_000}
          rows={6}
          required
          aria-describedby={`${formId}-help`}
        />

        <p
          id={`${formId}-help`}
          className="page-description"
        >
          Explica qué ocurrió, qué equipo o servicio está
          afectado y cómo impide tu trabajo. No incluyas
          contraseñas.
        </p>

        <button type="submit" className="primary-button">
          {isSubmitting
            ? 'Registrando…'
            : hasSaved
              ? 'Incidencia registrada'
              : 'Registrar incidencia'}
        </button>
      </fieldset>

      {onCancel && !showDiscardConfirmation && (
        <div className="section-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="secondary-button"
            disabled={isSubmitting}
            onClick={handleCancel}
          >
            {hasSaved ? 'Cerrar formulario' : 'Cancelar'}
          </button>
        </div>
      )}

      {showDiscardConfirmation && (
        <section
          className="create-panel"
          aria-labelledby={`${formId}-discard-heading`}
        >
          <h3 id={`${formId}-discard-heading`}>
            ¿Descartar lo escrito?
          </h3>

          <p>
            Si cierras el formulario, se perderán el título
            y la descripción que todavía no has registrado.
          </p>

          <div className="section-actions">
            <button
              ref={keepEditingRef}
              type="button"
              className="primary-button"
              onClick={handleKeepEditing}
            >
              Seguir escribiendo
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                if (!submissionInProgress.current) {
                  onCancel?.()
                }
              }}
            >
              Descartar y cerrar
            </button>
          </div>
        </section>
      )}

      {isSubmitting && (
        <p role="status">Registrando incidencia…</p>
      )}

      {errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p role="status">{successMessage}</p>
      )}
    </form>
  )
}