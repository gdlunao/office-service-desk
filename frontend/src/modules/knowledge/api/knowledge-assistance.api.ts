import { KnowledgeRecommendationsApiError } from './recommendations.api'
import type {
  IncidentKnowledgeAssistance,
} from '../types/knowledge-assistance.types'

export async function requestIncidentKnowledgeAssistance(
  accessToken: string,
  incidentId: number,
  signal: AbortSignal,
): Promise<IncidentKnowledgeAssistance> {
  const response = await fetch(
    `/api/v1/incidents/assigned/${incidentId}/knowledge-assistance`,
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
          ? 'Se requiere una cuenta activa con rol de técnico.'
          : response.status === 404
            ? 'La incidencia no está disponible entre tus asignaciones.'
            : response.status === 409
              ? 'No se puede generar orientación para esta incidencia en este momento.'
              : response.status === 503
                ? 'La asistencia IA no está disponible. Puedes consultar los artículos publicados.'
                : response.status === 502
                  ? 'La IA no devolvió una orientación válida. Puedes consultar los artículos publicados.'
                  : 'No se pudo solicitar la orientación. Puedes continuar con la atención manual.'

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

    throw new KnowledgeRecommendationsApiError(
      message,
      response.status,
    )
  }

  return (
    await response.json()
  ) as IncidentKnowledgeAssistance
}