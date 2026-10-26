import { IncidentsApiError } from './incidents.api'
import type {
  IncidentCategory,
  IncidentImpact,
  IncidentPriority,
  IncidentUrgency,
} from '../types/classification.types'

export interface ClassificationSuggestion {
  incident_id: number
  category: IncidentCategory
  impact: IncidentImpact
  urgency: IncidentUrgency
  priority: IncidentPriority
  explanation: string
  provider: 'gemini'
  model: string
  requires_review: true
}

export async function suggestIncidentClassification(
  accessToken: string,
  incidentId: number,
  signal: AbortSignal,
): Promise<ClassificationSuggestion> {
  const response = await fetch(
    `/api/v1/incidents/queue/${incidentId}/classification-suggestion`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      signal,
    },
  )

  if (!response.ok) {
    let message =
      response.status === 401
        ? 'La sesión ha vencido. Ingresa nuevamente.'
        : response.status === 403
          ? 'Solo el responsable TI puede solicitar sugerencias.'
          : response.status === 404
            ? 'La incidencia no está disponible.'
            : response.status === 409
              ? 'La incidencia ya no admite clasificación. Actualiza el detalle.'
              : response.status === 503
                ? 'La asistencia IA no está disponible. Puedes clasificar manualmente.'
                : response.status === 502
                  ? 'La IA no devolvió una sugerencia válida. Puedes clasificar manualmente.'
                  : 'No se pudo consultar la sugerencia. Puedes clasificar manualmente.'

    if (
      response.status === 409 ||
      response.status === 502 ||
      response.status === 503
    ) {
      try {
        const body: unknown = await response.json()

        if (
          typeof body === 'object' &&
          body !== null &&
          'detail' in body &&
          typeof body.detail === 'string'
        ) {
          message = body.detail
        }
      } catch {
        // Conserva el mensaje correspondiente al estado HTTP.
      }
    }

    throw new IncidentsApiError(message, response.status)
  }

  return (await response.json()) as ClassificationSuggestion
}