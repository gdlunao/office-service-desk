import { useEffect, useState } from 'react'

import {
  IncidentsApiError,
  listIncidentQueue,
} from '../api/incidents.api'
import { IncidentDetail } from '../components/IncidentDetail'
import { INCIDENT_STATUS_LABELS } from '../types/incident.types'
import type { Incident } from '../types/incident.types'
import {
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_PRIORITY_LABELS,
} from '../types/classification.types'

interface IncidentQueuePageProps {
  accessToken: string
  onSessionExpired: () => void
}

const PAGE_SIZE = 20

export function IncidentQueuePage({
  accessToken,
  onSessionExpired,
}: IncidentQueuePageProps) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [offset, setOffset] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
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

    async function loadQueue() {
      setIsLoading(true)
      setErrorMessage('')
      setIncidents([])

      try {
        const result = await listIncidentQueue(
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
                : 'No se pudo cargar la bandeja de incidencias.',
        )
      } finally {
        window.clearTimeout(timeoutId)

        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadQueue()

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [accessToken, offset, reloadKey, onSessionExpired])

  function handleRefresh() {
    setSelectedIncidentId(null)
    setReloadKey((value) => value + 1)
  }

  function handlePreviousPage() {
    setSelectedIncidentId(null)
    setOffset((value) => Math.max(0, value - PAGE_SIZE))
  }

  function handleNextPage() {
    setSelectedIncidentId(null)
    setOffset((value) => value + PAGE_SIZE)
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
          <h1>Bandeja TI</h1>
          <p className="page-description">
            Consulta las incidencias registradas por los colaboradores.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={isLoading}
          onClick={handleRefresh}
        >
          Actualizar
        </button>
      </div>

      <div aria-busy={isLoading}>
        {isLoading ? (
          <p role="status">Cargando bandeja de incidencias…</p>
        ) : errorMessage ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : incidents.length === 0 ? (
          <p>
            {offset === 0
              ? 'Todavía no hay incidencias registradas.'
              : 'No hay incidencias en esta página.'}
          </p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <caption>Incidencias de los colaboradores</caption>

              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Título</th>
                  <th scope="col">Reportante</th>
                  <th scope="col">Categoría</th>
                  <th scope="col">Prioridad</th>
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
                      {incident.reporter_name ||
                        'Nombre no disponible'}
                    </td>

                    <td>
                      {incident.category
                        ? INCIDENT_CATEGORY_LABELS[
                            incident.category
                          ] ?? 'Categoría desconocida'
                        : 'Sin clasificar'}
                    </td>

                    <td>
                      {incident.priority
                        ? INCIDENT_PRIORITY_LABELS[
                            incident.priority
                          ] ?? 'Prioridad desconocida'
                        : 'Sin determinar'}
                    </td>

                    <td>
                      {INCIDENT_STATUS_LABELS[incident.status] ??
                        'Estado desconocido'}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="secondary-button"
                        aria-label={
                          `Ver detalle de la incidencia ${incident.id}`
                        }
                        aria-expanded={
                          selectedIncidentId === incident.id
                        }
                        aria-controls={
                          selectedIncidentId === incident.id
                            ? 'queue-incident-detail-panel'
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
      </div>

      <div className="pagination">
        <button
          type="button"
          className="secondary-button"
          disabled={isLoading || offset === 0}
          onClick={handlePreviousPage}
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
          onClick={handleNextPage}
        >
          Siguiente
        </button>
      </div>

      {selectedIncidentId !== null && (
        <div id="queue-incident-detail-panel">
            <IncidentDetail
            key={selectedIncidentId}
            accessToken={accessToken}
            incidentId={selectedIncidentId}
            mode="queue"
            onClose={() => setSelectedIncidentId(null)}
            onSessionExpired={onSessionExpired}
            onIncidentUpdated={handleIncidentUpdated}
          />
        </div>
      )}
    </section>
  )
}