import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import {
  suggestIncidentClassification,
} from '../api/classification-ai.api'
import type {
  ClassificationSuggestion,
} from '../api/classification-ai.api'
import {
  classifyIncident,
  IncidentsApiError,
} from '../api/incidents.api'
import {
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_IMPACT_LABELS,
  INCIDENT_PRIORITY_LABELS,
  INCIDENT_URGENCY_LABELS,
} from '../types/classification.types'
import type {
  IncidentCategory,
  IncidentImpact,
  IncidentUrgency,
} from '../types/classification.types'
import type { Incident } from '../types/incident.types'

import './ClassifyIncidentForm.css'

interface ClassifyIncidentFormProps {
  accessToken: string
  incident: Incident
  onClassified: (incident: Incident) => void
  onSessionExpired: () => void
}

export function ClassifyIncidentForm({
  accessToken,
  incident,
  onClassified,
  onSessionExpired,
}: ClassifyIncidentFormProps) {
  const formId = useId()

  const [category, setCategory] =
    useState<IncidentCategory | ''>(incident.category ?? '')
  const [impact, setImpact] =
    useState<IncidentImpact | ''>(incident.impact ?? '')
  const [urgency, setUrgency] =
    useState<IncidentUrgency | ''>(incident.urgency ?? '')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasSaved, setHasSaved] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [suggestion, setSuggestion] =
    useState<ClassificationSuggestion | null>(null)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [suggestionError, setSuggestionError] = useState('')
  const [suggestionNotice, setSuggestionNotice] = useState('')

  const isActive = useRef(true)
  const submissionInProgress = useRef(false)
  const suggestionController =
    useRef<AbortController | null>(null)

  useEffect(() => {
    isActive.current = true

    return () => {
      isActive.current = false
      suggestionController.current?.abort()
      suggestionController.current = null
    }
  }, [])

  const canClassify =
    (
      incident.status === 'reported' ||
      incident.status === 'assigned' ||
      incident.status === 'in_progress'
    ) &&
    incident.resolved_at === null &&
    incident.closed_at === null

  const isBusy = isSubmitting || isSuggesting

  async function handleSuggest() {
    if (
      suggestionController.current !== null ||
      submissionInProgress.current ||
      hasSaved ||
      !canClassify
    ) {
      return
    }

    const controller = new AbortController()
    suggestionController.current = controller

    let timedOut = false

    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 30_000)

    setIsSuggesting(true)
    setSuggestion(null)
    setSuggestionError('')
    setSuggestionNotice('')

    try {
      const result = await suggestIncidentClassification(
        accessToken,
        incident.id,
        controller.signal,
      )

      if (
        !isActive.current ||
        controller.signal.aborted ||
        suggestionController.current !== controller
      ) {
        return
      }

      setSuggestion(result)
    } catch (error: unknown) {
      if (
        !isActive.current ||
        suggestionController.current !== controller
      ) {
        return
      }

      if (
        error instanceof IncidentsApiError &&
        error.status === 401
      ) {
        onSessionExpired()
        return
      }

      setSuggestionError(
        timedOut
          ? 'La consulta tardó demasiado. Puedes continuar con la clasificación manual.'
          : error instanceof IncidentsApiError
            ? error.message
            : 'No se pudo consultar la IA. Comprueba la conexión o clasifica manualmente.',
      )
    } finally {
      window.clearTimeout(timeoutId)

      if (suggestionController.current === controller) {
        suggestionController.current = null

        if (isActive.current) {
          setIsSuggesting(false)
        }
      }
    }
  }

  function handleApplySuggestion() {
    if (
      !suggestion ||
      isBusy ||
      hasSaved ||
      !canClassify
    ) {
      return
    }

    setCategory(suggestion.category)
    setImpact(suggestion.impact)
    setUrgency(suggestion.urgency)

    setErrorMessage('')
    setSuggestionNotice(
      'Los valores se copiaron al formulario. Puedes modificarlos. Pulsa Guardar clasificación para confirmar.',
    )
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      submissionInProgress.current ||
      suggestionController.current !== null ||
      hasSaved ||
      !canClassify
    ) {
      return
    }

    setErrorMessage('')

    if (!category || !impact || !urgency) {
      setErrorMessage(
        'Selecciona la categoría, el impacto y la urgencia.',
      )
      return
    }

    submissionInProgress.current = true
    setIsSubmitting(true)

    let updatedIncident: Incident | null = null

    try {
      const result = await classifyIncident(
        accessToken,
        incident.id,
        {
          category,
          impact,
          urgency,
        },
      )

      if (!isActive.current) return

      updatedIncident = result
      setHasSaved(true)
      setSuggestionNotice('')
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
        error instanceof IncidentsApiError
          ? error.message
          : error instanceof DOMException &&
              error.name === 'TimeoutError'
            ? 'El servidor tardó demasiado. Actualiza el detalle para comprobar si la clasificación quedó guardada.'
            : 'No se pudo confirmar el guardado. Comprueba la conexión y actualiza el detalle antes de reintentar.',
      )
    } finally {
      submissionInProgress.current = false

      if (isActive.current) {
        setIsSubmitting(false)
      }
    }

    if (updatedIncident && isActive.current) {
      onClassified(updatedIncident)
    }
  }

  return (
    <form
      className="classification-form"
      onSubmit={handleSubmit}
      aria-busy={isBusy}
    >
      <fieldset
        disabled={isBusy || hasSaved || !canClassify}
      >
        <legend>Clasificación de la incidencia</legend>

        <p className="page-description">
          Selecciona la categoría y evalúa el impacto y la
          urgencia. El sistema calculará la prioridad al guardar.
        </p>

        <section
          className="incident-assignment-panel"
          aria-labelledby={`${formId}-ai-heading`}
        >
          <h4 id={`${formId}-ai-heading`}>
            Asistencia para la clasificación
          </h4>

          <p className="page-description">
            Puedes solicitar una sugerencia basada en el título
            y la descripción. Revisa sus valores antes de guardar.
          </p>

          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleSuggest()}
          >
            {isSuggesting
              ? 'Consultando IA…'
              : 'Sugerir clasificación con IA'}
          </button>

          {suggestion && (
            <div>
              <h4>Sugerencia pendiente de revisión</h4>

              <dl className="incident-detail-fields">
                <div>
                  <dt>Categoría sugerida</dt>
                  <dd>
                    {suggestion.category}
                    {' · '}
                    {INCIDENT_CATEGORY_LABELS[
                      suggestion.category
                    ]}
                  </dd>
                </div>

                <div>
                  <dt>Impacto sugerido</dt>
                  <dd>
                    {INCIDENT_IMPACT_LABELS[
                      suggestion.impact
                    ]}
                  </dd>
                </div>

                <div>
                  <dt>Urgencia sugerida</dt>
                  <dd>
                    {INCIDENT_URGENCY_LABELS[
                      suggestion.urgency
                    ]}
                  </dd>
                </div>

                <div>
                  <dt>Prioridad de esta sugerencia</dt>
                  <dd>
                    {INCIDENT_PRIORITY_LABELS[
                      suggestion.priority
                    ]}
                  </dd>
                </div>
              </dl>

              <p className="incident-description">
                {suggestion.explanation}
              </p>

              <p className="page-description">
                La prioridad mostrada corresponde a la
                sugerencia. Si cambias el impacto o la urgencia,
                el sistema calculará la prioridad definitiva
                al guardar.
              </p>

              <button
                type="button"
                className="secondary-button"
                onClick={handleApplySuggestion}
              >
                Usar estos valores en el formulario
              </button>
            </div>
          )}
        </section>

        <div className="classification-form-fields">
          <div className="classification-form-field">
            <label htmlFor={`${formId}-category`}>
              Categoría
            </label>

            <select
              id={`${formId}-category`}
              value={category}
              required
              onChange={(event) =>
                setCategory(
                  event.target.value as IncidentCategory | '',
                )
              }
            >
              <option value="">
                Selecciona una categoría
              </option>

              {Object.entries(INCIDENT_CATEGORY_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {value} · {label}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="classification-form-field">
            <label htmlFor={`${formId}-impact`}>
              Impacto
            </label>

            <select
              id={`${formId}-impact`}
              value={impact}
              required
              onChange={(event) =>
                setImpact(
                  event.target.value as IncidentImpact | '',
                )
              }
            >
              <option value="">Selecciona el impacto</option>

              {Object.entries(INCIDENT_IMPACT_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="classification-form-field">
            <label htmlFor={`${formId}-urgency`}>
              Urgencia
            </label>

            <select
              id={`${formId}-urgency`}
              value={urgency}
              required
              onChange={(event) =>
                setUrgency(
                  event.target.value as IncidentUrgency | '',
                )
              }
            >
              <option value="">Selecciona la urgencia</option>

              {Object.entries(INCIDENT_URGENCY_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>

        <button type="submit" className="primary-button">
          {isSubmitting
            ? 'Guardando…'
            : hasSaved
              ? 'Clasificación guardada'
              : 'Guardar clasificación'}
        </button>
      </fieldset>

      {isSuggesting && (
        <p role="status">
          Consultando la sugerencia de clasificación…
        </p>
      )}

      {suggestionError && (
        <p className="form-error" role="alert">
          {suggestionError}
        </p>
      )}

      {suggestionNotice && (
        <p role="status">
          {suggestionNotice}
        </p>
      )}

      {!canClassify && (
        <p role="status">
          La clasificación solo puede modificarse mientras la
          incidencia esté reportada, asignada o en atención.
        </p>
      )}

      {errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {hasSaved && (
        <p role="status">
          La clasificación se guardó correctamente.
        </p>
      )}
    </form>
  )
}