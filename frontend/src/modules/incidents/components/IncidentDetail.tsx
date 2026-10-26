import { useEffect, useId, useState } from 'react'

import { AttachmentPanel } from '../../attachments/components/AttachmentPanel'
import { CreateKnowledgeDraftButton } from '../../knowledge/components/CreateKnowledgeDraftButton'
import {
  getMyAssignment,
  getMyIncident,
  getQueueIncident,
  IncidentsApiError,
} from '../api/incidents.api'
import {
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_IMPACT_LABELS,
  INCIDENT_PRIORITY_LABELS,
  INCIDENT_URGENCY_LABELS,
} from '../types/classification.types'
import { INCIDENT_STATUS_LABELS } from '../types/incident.types'
import type { Incident } from '../types/incident.types'
import { AssignIncidentForm } from './AssignIncidentForm'
import { ClassifyIncidentForm } from './ClassifyIncidentForm'
import { CloseIncidentForm } from './CloseIncidentForm'
import { IncidentHistory } from './IncidentHistory'
import { ReturnIncidentForm } from './ReturnIncidentForm'
import { SolutionAttemptActions } from './SolutionAttemptActions'
import { SolutionAttemptsPanel } from './SolutionAttemptsPanel'
import { StartIncidentButton } from './StartIncidentButton'
import { KnowledgeRecommendationsPanel } from '../../knowledge/components/KnowledgeRecommendationsPanel'
import { KnowledgeAssistancePanel } from '../../knowledge/components/KnowledgeAssistancePanel'

interface IncidentDetailProps {
  accessToken: string
  incidentId: number
  mode?: 'own' | 'queue' | 'assigned'
  onClose: () => void
  onSessionExpired: () => void
  onIncidentUpdated?: (incident: Incident) => void
}

function formatIncidentDate(
  value: string | null | undefined,
  emptyMessage: string,
): string {
  if (!value) return emptyMessage

  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    ? value
    : `${value}Z`

  const date = new Date(normalized)

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible'
  }

  return date.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
  })
}

export function IncidentDetail({
  accessToken,
  incidentId,
  mode = 'own',
  onClose,
  onSessionExpired,
  onIncidentUpdated,
}: IncidentDetailProps) {
  const headingId = useId()
  const returnHeadingId = useId()

  const [incident, setIncident] = useState<Incident | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [classificationMessage, setClassificationMessage] =
    useState('')
  const [classificationRevision, setClassificationRevision] =
    useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true
    let timedOut = false

    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 15_000)

    async function loadDetail() {
      setIsLoading(true)
      setErrorMessage('')
      setClassificationMessage('')
      setIncident(null)

      try {
        const getIncident =
          mode === 'queue'
            ? getQueueIncident
            : mode === 'assigned'
              ? getMyAssignment
              : getMyIncident

        const result = await getIncident(
          accessToken,
          incidentId,
          controller.signal,
        )

        if (isActive) {
          setIncident(result)
        }
      } catch (error: unknown) {
        if (!isActive) return

        if (
          error instanceof IncidentsApiError &&
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
                : 'No se pudo cargar el detalle.',
        )
      } finally {
        window.clearTimeout(timeoutId)

        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [
    accessToken,
    incidentId,
    mode,
    reloadKey,
    onSessionExpired,
  ])

  function handleIncidentUpdated(updatedIncident: Incident) {
    setIncident(updatedIncident)
    onIncidentUpdated?.(updatedIncident)
  }

  function handleIncidentClassified(updatedIncident: Incident) {
    setClassificationMessage(
      'La clasificación se guardó correctamente.',
    )

    setClassificationRevision((value) => value + 1)
    handleIncidentUpdated(updatedIncident)
  }

  const canClassify =
    mode === 'queue' &&
    incident !== null &&
    (
      incident.status === 'reported' ||
      incident.status === 'assigned' ||
      incident.status === 'in_progress'
    ) &&
    incident.resolved_at === null &&
    incident.closed_at === null

  const canAssign =
    mode === 'queue' &&
    incident !== null &&
    incident.status === 'reported' &&
    incident.assigned_to_id === null &&
    incident.assigned_by_id === null &&
    incident.assigned_at === null

  const canStart =
    mode === 'assigned' &&
    incident !== null &&
    incident.status === 'assigned' &&
    incident.started_at === null

  const canResolve =
    mode === 'assigned' &&
    incident !== null &&
    incident.status === 'in_progress' &&
    incident.started_at !== null &&
    incident.resolved_at === null &&
    incident.resolution_summary === null

  const canClose =
    mode === 'own' &&
    incident !== null &&
    incident.status === 'pending_confirmation' &&
    incident.resolved_at !== null &&
    incident.resolution_summary !== null &&
    incident.closed_at === null

  const canCreateKnowledgeDraft =
    incident !== null &&
    incident.status === 'closed' &&
    (mode === 'queue' || mode === 'assigned')

  return (
    <section
      className="incident-detail"
      aria-labelledby={headingId}
    >
      <div className="section-heading">
        <h2 id={headingId}>
          Detalle de la incidencia #{incidentId}
        </h2>

        <div className="section-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={isLoading}
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Actualizar detalle
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
          >
            Cerrar detalle
          </button>
        </div>
      </div>

      <div aria-busy={isLoading}>
        {isLoading ? (
          <p role="status">Cargando detalle…</p>
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
        ) : incident ? (
          <>
            <dl className="incident-detail-fields">
              <div>
                <dt>Título</dt>
                <dd>{incident.title}</dd>
              </div>

              {mode !== 'own' && (
                <div>
                  <dt>Reportante</dt>
                  <dd>{incident.reporter_name}</dd>
                </div>
              )}

              <div>
                <dt>Estado</dt>
                <dd>
                  {INCIDENT_STATUS_LABELS[incident.status] ??
                    'Estado desconocido'}
                </dd>
              </div>

              <div>
                <dt>Categoría</dt>
                <dd>
                  {incident.category
                    ? INCIDENT_CATEGORY_LABELS[incident.category] ??
                      'Categoría desconocida'
                    : 'Sin clasificar'}
                </dd>
              </div>

              <div>
                <dt>Impacto</dt>
                <dd>
                  {incident.impact
                    ? INCIDENT_IMPACT_LABELS[incident.impact] ??
                      'Impacto desconocido'
                    : 'Sin evaluar'}
                </dd>
              </div>

              <div>
                <dt>Urgencia</dt>
                <dd>
                  {incident.urgency
                    ? INCIDENT_URGENCY_LABELS[incident.urgency] ??
                      'Urgencia desconocida'
                    : 'Sin evaluar'}
                </dd>
              </div>

              <div>
                <dt>Prioridad</dt>
                <dd>
                  {incident.priority
                    ? INCIDENT_PRIORITY_LABELS[incident.priority] ??
                      'Prioridad desconocida'
                    : 'Sin determinar'}
                </dd>
              </div>

              <div>
                <dt>Última clasificación</dt>
                <dd>
                  {formatIncidentDate(
                    incident.classified_at,
                    'Todavía no registrada',
                  )}
                </dd>
              </div>

              <div>
                <dt>Técnico asignado</dt>
                <dd>
                  {incident.assigned_to_id === null
                    ? 'Sin asignar'
                    : incident.assigned_to_name ??
                      'Nombre no disponible'}
                </dd>
              </div>

              {mode === 'queue' &&
                incident.assigned_by_id !== null && (
                  <div>
                    <dt>Asignado por</dt>
                    <dd>
                      {incident.assigned_by_name ??
                        'Nombre no disponible'}
                    </dd>
                  </div>
                )}

              <div>
                <dt>Inicio de atención</dt>
                <dd>
                  {formatIncidentDate(
                    incident.started_at,
                    'Todavía no iniciada',
                  )}
                </dd>
              </div>

              <div>
                <dt>Recuperación registrada</dt>
                <dd>
                  {formatIncidentDate(
                    incident.resolved_at,
                    'Todavía no registrada',
                  )}
                </dd>
              </div>

              <div>
                <dt>Cierre confirmado</dt>
                <dd>
                  {formatIncidentDate(
                    incident.closed_at,
                    'Todavía no confirmado',
                  )}
                </dd>
              </div>
            </dl>

            <h3>Descripción</h3>

            <p className="incident-description">
              {incident.description}
            </p>

            {incident.resolution_summary !== null && (
              <section>
                <h3>Solución aplicada</h3>

                <p className="incident-description">
                  {incident.resolution_summary}
                </p>
              </section>
            )}

            {classificationMessage && (
              <p role="status">{classificationMessage}</p>
            )}

            {canClassify && (
              <ClassifyIncidentForm
                key={
                  `classification-${incident.id}-${classificationRevision}`
                }
                accessToken={accessToken}
                incident={incident}
                onClassified={handleIncidentClassified}
                onSessionExpired={onSessionExpired}
              />
            )}

            {canAssign && (
              <section className="incident-assignment-panel">
                <h3>Asignar incidencia</h3>

                <p className="page-description">
                  Selecciona al técnico que atenderá este reporte.
                </p>

                <AssignIncidentForm
                  key={incident.id}
                  accessToken={accessToken}
                  incidentId={incident.id}
                  onIncidentAssigned={handleIncidentUpdated}
                  onSessionExpired={onSessionExpired}
                />
              </section>
            )}

            {canStart && (
              <section className="incident-assignment-panel">
                <h3>Iniciar atención</h3>

                <p className="page-description">
                  Al iniciar, la incidencia pasará a En atención
                  y se registrará la fecha de inicio.
                </p>

                <StartIncidentButton
                  key={incident.id}
                  accessToken={accessToken}
                  incidentId={incident.id}
                  onIncidentStarted={handleIncidentUpdated}
                  onSessionExpired={onSessionExpired}
                />
              </section>
            )}

            {canResolve && (
              <SolutionAttemptActions
                key={`actions-${incident.id}-${reloadKey}`}
                accessToken={accessToken}
                incidentId={incident.id}
                onAttemptChanged={() =>
                  setReloadKey((value) => value + 1)
                }
                onSessionExpired={onSessionExpired}
              />
            )}

            {canClose && (
              <section className="incident-assignment-panel">
                <h3>Confirmar cierre</h3>

                <CloseIncidentForm
                  key={incident.id}
                  accessToken={accessToken}
                  incidentId={incident.id}
                  onIncidentClosed={handleIncidentUpdated}
                  onSessionExpired={onSessionExpired}
                />
              </section>
            )}

            {canClose && (
              <section
                className="incident-return-panel"
                aria-labelledby={returnHeadingId}
              >
                <h3 id={returnHeadingId}>
                  ¿El problema persiste?
                </h3>

                <p className="page-description">
                  Si el servicio todavía presenta fallas, explica
                  el motivo para que el técnico continúe con
                  la atención.
                </p>

                <ReturnIncidentForm
                  key={incident.id}
                  accessToken={accessToken}
                  incidentId={incident.id}
                  onIncidentReturned={handleIncidentUpdated}
                  onSessionExpired={onSessionExpired}
                />
              </section>
            )}

            {canCreateKnowledgeDraft && (
              <CreateKnowledgeDraftButton
                key={incident.id}
                accessToken={accessToken}
                incidentId={incident.id}
                onSessionExpired={onSessionExpired}
              />
            )}

              {mode === 'assigned' &&
            (
              incident.status === 'assigned' ||
              incident.status === 'in_progress'
            ) &&
            incident.resolved_at === null &&
            incident.closed_at === null && (
              <KnowledgeAssistancePanel
                key={`assistance-${incident.id}`}
                accessToken={accessToken}
                incidentId={incident.id}
                onSessionExpired={onSessionExpired}
              />
            )}
            {mode === 'assigned' && (
              <KnowledgeRecommendationsPanel
                key={`recommendations-${incident.id}`}
                accessToken={accessToken}
                incidentId={incident.id}
                onSessionExpired={onSessionExpired}
              />
            )}

            <AttachmentPanel
              key={incident.id}
              accessToken={accessToken}
              incidentId={incident.id}
              canUpload={incident.status !== 'closed'}
              onSessionExpired={onSessionExpired}
            />

            <SolutionAttemptsPanel
              key={`attempts-${incident.id}-${incident.status}`}
              accessToken={accessToken}
              incidentId={incident.id}
              onSessionExpired={onSessionExpired}
            />

            <IncidentHistory
              key={
                `history-${incident.id}-${incident.status}-${classificationRevision}`
              }
              accessToken={accessToken}
              incidentId={incident.id}
              onSessionExpired={onSessionExpired}
            />
          </>
        ) : null}
      </div>
    </section>
  )
}