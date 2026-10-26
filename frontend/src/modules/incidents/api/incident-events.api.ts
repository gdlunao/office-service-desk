import type { IncidentEvent } from '../types/incident-event.types'
import { IncidentsApiError } from './incidents.api'

export async function listIncidentEvents(
  accessToken: string,
  incidentId: number,
  offset: number,
  limit: number,
  signal: AbortSignal,
): Promise<IncidentEvent[]> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  })

  const response = await fetch(
    `/api/v1/incidents/${incidentId}/events?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      signal,
    },
  )

  if (!response.ok) {
    const message =
      response.status === 401
        ? 'La sesión ha vencido. Ingresa nuevamente.'
        : response.status === 404
          ? 'El historial no está disponible para tu cuenta.'
          : response.status === 403
            ? 'No tienes permisos para consultar este historial.'
            : 'No se pudo cargar el historial de la incidencia.'

    throw new IncidentsApiError(message, response.status)
  }

  return (await response.json()) as IncidentEvent[]
}