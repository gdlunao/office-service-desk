import type {
  IncidentIndicatorFilters,
  IncidentIndicators,
} from '../types/report.types'

export class ReportsApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ReportsApiError'
    this.status = status
  }
}

export async function getIncidentIndicators(
  accessToken: string,
  filters: IncidentIndicatorFilters,
  signal: AbortSignal,
): Promise<IncidentIndicators> {
  const params = new URLSearchParams()

  if (filters.period_start) {
    params.set('period_start', filters.period_start)
  }

  if (filters.period_end) {
    params.set('period_end', filters.period_end)
  }

  const query = params.toString()

  const url = query
    ? `/api/v1/reports/incident-indicators?${query}`
    : '/api/v1/reports/incident-indicators'

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    let message =
      response.status === 401
        ? 'La sesión ha vencido. Ingresa nuevamente.'
        : response.status === 403
          ? 'Solo el responsable TI puede consultar los indicadores.'
          : response.status === 422
            ? 'Revisa las fechas del período seleccionado.'
            : 'No se pudieron cargar los indicadores.'

    if (response.status === 422) {
      try {
        const body: unknown = await response.json()

        if (
          typeof body === 'object' &&
          body !== null &&
          'detail' in body &&
          typeof body.detail === 'string' &&
          body.detail.trim()
        ) {
          message = body.detail
        }
      } catch {
        // Conservamos el mensaje general si no hay JSON válido.
      }
    }

    throw new ReportsApiError(
      message,
      response.status,
    )
  }

  return (await response.json()) as IncidentIndicators
}