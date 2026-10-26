import type {
  IncidentKnowledgeRecommendations,
} from '../types/recommendation.types'

export class KnowledgeRecommendationsApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'KnowledgeRecommendationsApiError'
    this.status = status
  }
}

export async function getIncidentKnowledgeRecommendations(
  accessToken: string,
  incidentId: number,
  signal: AbortSignal,
): Promise<IncidentKnowledgeRecommendations> {
  const response = await fetch(
    `/api/v1/incidents/assigned/${incidentId}/knowledge-recommendations?limit=5`,
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
        : response.status === 403
          ? 'Se requiere una cuenta activa con rol de técnico.'
          : response.status === 404
            ? 'La incidencia no está disponible entre tus asignaciones.'
            : 'No se pudieron consultar los artículos relacionados.'

    throw new KnowledgeRecommendationsApiError(
      message,
      response.status,
    )
  }

  return (
    await response.json()
  ) as IncidentKnowledgeRecommendations
}