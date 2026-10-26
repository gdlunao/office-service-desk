import { useEffect, useState } from 'react'

import {
  IncidentsApiError,
  listMyIncidents,
} from '../api/incidents.api'
import { CreateIncidentForm } from '../components/CreateIncidentForm'
import { IncidentDetail } from '../components/IncidentDetail'
import { INCIDENT_STATUS_LABELS } from '../types/incident.types'
import type { Incident } from '../types/incident.types'
import { useToast } from '../../../shared/feedback/toast-context'

interface IncidentsPageProps {
  accessToken: string
  onSessionExpired: () => void
}

const PAGE_SIZE = 20

export function IncidentsPage({
  accessToken,
  onSessionExpired,
}: IncidentsPageProps) {
  const { showToast } = useToast()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [offset, setOffset] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedIncidentId, setSelectedIncidentId] =
    useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true
    let timedOut = false

    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 15_000)

    async function loadIncidents() {
      setIsLoading(true)
      setErrorMessage('')
      setIncidents([])

      try {
        const result = await listMyIncidents(
          accessToken,
          offset,
          PAGE_SIZE,
          controller.signal,
        )

        if (isActive) {
          setIncidents(result)
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
                : 'No se pudo cargar el listado de incidencias.',
        )
      } finally {
        window.clearTimeout(timeoutId)

        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadIncidents()

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [accessToken, offset, reloadKey, onSessionExpired])

  function handleIncidentCreated() {
    setShowCreateForm(false)
    setSelectedIncidentId(null)
    setOffset(0)
    setReloadKey((value) => value + 1)

    showToast({
      type: 'success',
      message: 'La incidencia se registró correctamente.',
    })
  }

  function handleIncidentUpdated(updatedIncident: Incident) {
    setIncidents((currentIncidents) =>
      currentIncidents.map((incident) =>
        incident.id === updatedIncident.id
          ? updatedIncident
          : incident,
      ),
    )
  }

  return (
    <section className="content-card">
      <div className="section-heading">
        <div>
          <h1>Mis incidencias</h1>
          <p className="page-description">
            Registra problemas TI y consulta el estado de tus reportes.
          </p>
        </div>

        <div className="section-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={isLoading}
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Actualizar
          </button>

          <button
            type="button"
            className="primary-button"
            aria-expanded={showCreateForm}
            aria-controls="create-incident-panel"
            onClick={() => setShowCreateForm(true)}
          >
            Nueva incidencia
          </button>
        </div>
      </div>

      {showCreateForm && (
        <section
          id="create-incident-panel"
          className="create-panel"
          aria-labelledby="create-incident-heading"
        >
          <h2 id="create-incident-heading">Nueva incidencia</h2>

          <p className="page-description">
            El reporte se registrará a nombre de tu cuenta con el
            estado inicial Reportada.
          </p>

          <CreateIncidentForm
            accessToken={accessToken}
            onIncidentCreated={handleIncidentCreated}
            onSessionExpired={onSessionExpired}
            onCancel={() => setShowCreateForm(false)}
          />
        </section>
      )}

      <div aria-busy={isLoading}>
        {isLoading ? (
          <p role="status">Cargando incidencias…</p>
        ) : errorMessage ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : incidents.length === 0 ? (
          <p>
            {offset === 0
              ? 'Todavía no tienes incidencias registradas.'
              : 'No hay incidencias en esta página.'}
          </p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <caption>Incidencias registradas por tu cuenta</caption>

              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Título</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {incidents.map((incident) => (
                  <tr key={incident.id}>
                    <td>{incident.id}</td>

                    <td>{incident.title}</td>

                    <td>
                      {INCIDENT_STATUS_LABELS[incident.status] ??
                        'Estado desconocido'}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="secondary-button"
                        aria-label={`Ver detalle de la incidencia ${incident.id}`}
                        aria-expanded={
                          selectedIncidentId === incident.id
                        }
                        aria-controls={
                          selectedIncidentId === incident.id
                            ? 'incident-detail-panel'
                            : undefined
                        }
                        onClick={() =>
                          setSelectedIncidentId(incident.id)
                        }
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <button
            type="button"
            className="secondary-button"
            disabled={isLoading || offset === 0}
            onClick={() =>
              setOffset((value) => Math.max(0, value - PAGE_SIZE))
            }
          >
            Anterior
          </button>

          <span>Página {offset / PAGE_SIZE + 1}</span>

          <button
            type="button"
            className="secondary-button"
            disabled={
              isLoading ||
              Boolean(errorMessage) ||
              incidents.length < PAGE_SIZE
            }
            onClick={() => setOffset((value) => value + PAGE_SIZE)}
          >
            Siguiente
          </button>
        </div>
      </div>

      {selectedIncidentId !== null && (
        <div id="incident-detail-panel">
          <IncidentDetail
            key={selectedIncidentId}
            accessToken={accessToken}
            incidentId={selectedIncidentId}
            onClose={() => setSelectedIncidentId(null)}
            onSessionExpired={onSessionExpired}
            onIncidentUpdated={handleIncidentUpdated}
          />
        </div>
      )}
    </section>
  )
}