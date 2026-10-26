import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { listActiveTechnicians } from '../../users/api/technicians.api'
import { UsersApiError } from '../../users/api/users.api'
import type { TechnicianOption } from '../../users/types/technician.types'
import {
  assignIncident,
  IncidentsApiError,
} from '../api/incidents.api'
import type { Incident } from '../types/incident.types'

interface AssignIncidentFormProps {
  accessToken: string
  incidentId: number
  onIncidentAssigned: (incident: Incident) => void
  onSessionExpired: () => void
}

const TECHNICIAN_PAGE_SIZE = 100

export function AssignIncidentForm({
  accessToken,
  incidentId,
  onIncidentAssigned,
  onSessionExpired,
}: AssignIncidentFormProps) {
  const [technicians, setTechnicians] =
    useState<TechnicianOption[]>([])
  const [selectedTechnicianId, setSelectedTechnicianId] =
    useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [requiresRefresh, setRequiresRefresh] = useState(false)
  const [isAssigned, setIsAssigned] = useState(false)

  const isMounted = useRef(false)
  const submissionInProgress = useRef(false)

  useEffect(() => {
    isMounted.current = true

    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true
    let timedOut = false

    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 15_000)

    async function loadTechnicians() {
      setIsLoading(true)
      setLoadError('')
      setTechnicians([])
      setSelectedTechnicianId('')

      try {
        const results: TechnicianOption[] = []
        let offset = 0

        while (true) {
          const page = await listActiveTechnicians(
            accessToken,
            offset,
            TECHNICIAN_PAGE_SIZE,
            controller.signal,
          )

          results.push(...page)

          if (page.length < TECHNICIAN_PAGE_SIZE) {
            break
          }

          offset += TECHNICIAN_PAGE_SIZE
        }

        if (isActive) {
          const uniqueTechnicians = [
            ...new Map(
              results.map((technician) => [
                technician.id,
                technician,
              ]),
            ).values(),
          ]

          setTechnicians(uniqueTechnicians)
        }
      } catch (error: unknown) {
        if (!isActive) return

        if (
          error instanceof UsersApiError &&
          error.status === 401
        ) {
          onSessionExpired()
          return
        }

        setLoadError(
          timedOut
            ? 'La consulta de técnicos tardó demasiado.'
            : error instanceof TypeError
              ? 'No se pudo conectar con el servidor.'
              : error instanceof Error
                ? error.message
                : 'No se pudo cargar el listado de técnicos.',
        )
      } finally {
        window.clearTimeout(timeoutId)

        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadTechnicians()

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [accessToken, reloadKey, onSessionExpired])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (
      submissionInProgress.current ||
      isLoading ||
      requiresRefresh ||
      isAssigned
    ) {
      return
    }

    setSubmitError('')

    const technicianId = Number(selectedTechnicianId)
    const isAvailableTechnician = technicians.some(
      (technician) => technician.id === technicianId,
    )

    if (
      !Number.isSafeInteger(technicianId) ||
      technicianId <= 0 ||
      !isAvailableTechnician
    ) {
      setSubmitError('Selecciona un técnico de la lista.')
      return
    }

    submissionInProgress.current = true
    setIsSubmitting(true)

    let assignedIncident: Incident

    try {
      assignedIncident = await assignIncident(
        accessToken,
        incidentId,
        { assigned_to_id: technicianId },
      )
    } catch (error: unknown) {
      if (!isMounted.current) return

      if (error instanceof IncidentsApiError) {
        if (error.status === 401) {
          onSessionExpired()
          return
        }

        if (
          error.status === 403 ||
          error.status === 404 ||
          error.status === 409 ||
          error.status >= 500
        ) {
          setRequiresRefresh(true)
        }

        setSubmitError(error.message)
      } else {
        setRequiresRefresh(true)

        setSubmitError(
          'No se pudo confirmar la asignación. Actualiza la bandeja ' +
            'y abre nuevamente el detalle antes de reintentar.',
        )
      }

      return
    } finally {
      submissionInProgress.current = false

      if (isMounted.current) {
        setIsSubmitting(false)
      }
    }

    if (!isMounted.current) return

    setIsAssigned(true)
    onIncidentAssigned(assignedIncident)
  }

  return (
    <form onSubmit={handleSubmit}>
      {isLoading ? (
        <p role="status">Cargando técnicos…</p>
      ) : loadError ? (
        <div>
          <p className="form-error" role="alert">
            {loadError}
          </p>

          <button
            type="button"
            className="secondary-button"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Reintentar consulta
          </button>
        </div>
      ) : technicians.length === 0 ? (
        <p role="status">
          No hay técnicos activos disponibles. Contacta al
          administrador para configurar una cuenta.
        </p>
      ) : (
        <fieldset
          disabled={
            isSubmitting || requiresRefresh || isAssigned
          }
        >
          <legend>Asignación a técnico</legend>

          <div className="form-field">
            <label htmlFor={`assigned-technician-${incidentId}`}>
              Técnico responsable
            </label>

            <select
              id={`assigned-technician-${incidentId}`}
              value={selectedTechnicianId}
              required
              onChange={(event) => {
                setSelectedTechnicianId(event.target.value)
                setSubmitError('')
              }}
            >
              <option value="">Selecciona un técnico</option>

              {technicians.map((technician) => (
                <option
                  key={technician.id}
                  value={technician.id}
                >
                  {technician.full_name} 
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="primary-button"
            disabled={!selectedTechnicianId}
          >
            {isSubmitting ? 'Asignando…' : 'Asignar incidencia'}
          </button>
        </fieldset>
      )}

      {submitError && (
        <p className="form-error" role="alert">
          {submitError}
        </p>
      )}

      {requiresRefresh && (
        <p>
          Pulsa Actualizar en la bandeja y abre nuevamente el
          detalle para consultar el estado actual.
        </p>
      )}

      {isAssigned && (
        <p role="status">La incidencia se asignó correctamente.</p>
      )}
    </form>
  )
}