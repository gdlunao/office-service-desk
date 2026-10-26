import { useEffect, useState } from 'react'

import {
  IncidentsApiError,
  listMyAssignments,
} from '../api/incidents.api'
import { IncidentDetail } from '../components/IncidentDetail'
import { INCIDENT_STATUS_LABELS } from '../types/incident.types'
import type { Incident } from '../types/incident.types'

interface MyAssignmentsPageProps {
  accessToken: string
  onSessionExpired: () => void
}

const PAGE_SIZE = 20

export function MyAssignmentsPage({
  accessToken,
  onSessionExpired,
}: MyAssignmentsPageProps) {
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

    async function loadAssignments() {
      setIsLoading(true)
      setErrorMessage('')
      setIncidents([])

      try {
        const result = await listMyAssignments(
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
                : 'No se pudo cargar el listado de asignaciones.',
        )
      } finally {
        window.clearTimeout(timeoutId)

        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadAssignments()

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [accessToken, offset, reloadKey, onSessionExpired])

  function handleIncidentUpdated(updatedIncident: Incident) {
    setIncidents((currentIncidents) =>
      currentIncidents.map((incident) =>
        incident.id === updatedIncident.id
          ? updatedIncident
          : incident,
      ),
    )
  }

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

  return (
    <section className="content-card">
      <div className="section-heading">
        <div>
          <h1>Mis asignaciones</h1>
          <p className="page-description">
            Consulta las incidencias asignadas a tu cuenta técnica.
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
          <p role="status">Cargando asignaciones…</p>
        ) : errorMessage ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : incidents.length === 0 ? (
          <p>
            {offset === 0
              ? 'Todavía no tienes incidencias asignadas.'
              : 'No hay asignaciones en esta página.'}
          </p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <caption>Incidencias asignadas a tu cuenta</caption>

              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Título</th>
                  <th scope="col">Reportante</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {incidents.map((incident) => (
                  <tr key={incident.id}>
                    <td>{incident.id}</td>
                    <td>{incident.title}</td>
                    <td>{incident.reporter_name || 'Nombre no disponible'}</td>
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
                            ? 'assignment-detail-panel'
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
        <div id="assignment-detail-panel">
          <IncidentDetail
            key={selectedIncidentId}
            accessToken={accessToken}
            incidentId={selectedIncidentId}
            mode="assigned"
            onClose={() => setSelectedIncidentId(null)}
            onSessionExpired={onSessionExpired}
            onIncidentUpdated={handleIncidentUpdated}
          />
        </div>
      )}
    </section>
  )
}