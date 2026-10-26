import type {
  SolutionAttempt,
  SolutionAttemptFinish,
  SolutionAttemptStart,
} from '../types/solution-attempt.types'

export class SolutionAttemptsApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'SolutionAttemptsApiError'
    this.status = status
  }
}

async function checkMutationResponse(
  response: Response,
): Promise<void> {
  if (response.ok) return

  let message =
    response.status === 401
      ? 'La sesión ha vencido. Ingresa nuevamente.'
      : response.status === 403
        ? 'No tienes permisos para realizar esta operación.'
        : response.status === 404
          ? 'La incidencia o el intento no están disponibles para tu cuenta.'
          : response.status === 409
            ? 'El estado cambió. Actualiza los datos antes de continuar.'
            : response.status === 422
              ? 'Revisa la descripción, las acciones y la evidencia.'
              : 'No se pudo confirmar la operación. Actualiza los datos antes de reintentar.'

  if (
    response.status === 409 ||
    response.status === 422
  ) {
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
      // Conservamos el mensaje general si la respuesta no es JSON.
    }
  }

  throw new SolutionAttemptsApiError(
    message,
    response.status,
  )
}

export async function listSolutionAttempts(
  accessToken: string,
  incidentId: number,
  offset: number,
  limit: number,
  signal: AbortSignal,
): Promise<SolutionAttempt[]> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  })

  const response = await fetch(
    `/api/v1/incidents/${incidentId}/attempts?${params}`,
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
          ? 'No tienes permisos para consultar estos intentos.'
          : response.status === 404
            ? 'La incidencia no está disponible para tu cuenta.'
            : 'No se pudieron cargar los intentos de solución.'

    throw new SolutionAttemptsApiError(
      message,
      response.status,
    )
  }

  return (await response.json()) as SolutionAttempt[]
}

export async function startSolutionAttempt(
  accessToken: string,
  incidentId: number,
  data: SolutionAttemptStart,
): Promise<SolutionAttempt> {
  const response = await fetch(
    `/api/v1/incidents/assigned/${incidentId}/attempts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(15_000),
    },
  )

  await checkMutationResponse(response)

  return (await response.json()) as SolutionAttempt
}

export async function finishSolutionAttempt(
  accessToken: string,
  incidentId: number,
  attemptId: number,
  data: SolutionAttemptFinish,
): Promise<SolutionAttempt> {
  const response = await fetch(
    `/api/v1/incidents/assigned/${incidentId}/attempts/${attemptId}/finish`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(15_000),
    },
  )

  await checkMutationResponse(response)

  return (await response.json()) as SolutionAttempt
}

export async function getLatestSolutionAttempt(
  accessToken: string,
  incidentId: number,
  signal: AbortSignal,
): Promise<SolutionAttempt | null> {
  const response = await fetch(
    `/api/v1/incidents/${incidentId}/attempts/latest`,
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
          ? 'No tienes permisos para consultar los intentos.'
          : response.status === 404
            ? 'La incidencia no está disponible para tu cuenta.'
            : 'No se pudo consultar el último intento.'

    throw new SolutionAttemptsApiError(
      message,
      response.status,
    )
  }

  return (await response.json()) as SolutionAttempt | null
}