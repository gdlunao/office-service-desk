import type {
  Incident,
  IncidentAssign,
  IncidentCreate,
  IncidentResolve,
  IncidentReturn,
} from '../types/incident.types'

import type {
  IncidentClassificationUpdate,
} from '../types/classification.types'

export class IncidentsApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'IncidentsApiError'
    this.status = status
  }
}

export async function listMyIncidents(
  accessToken: string,
  offset: number,
  limit: number,
  signal: AbortSignal,
): Promise<Incident[]> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  })

  const response = await fetch(`/api/v1/incidents?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    const message =
      response.status === 401
        ? 'La sesión ha vencido. Ingresa nuevamente.'
        : response.status === 403
          ? 'No tienes permisos para consultar estas incidencias.'
          : 'No se pudo cargar el listado de incidencias.'

    throw new IncidentsApiError(message, response.status)
  }

  return (await response.json()) as Incident[]
}

export async function createIncident(
  accessToken: string,
  data: IncidentCreate,
): Promise<Incident> {
  const response = await fetch('/api/v1/incidents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    const message =
      response.status === 401
        ? 'La sesión ha vencido. Ingresa nuevamente.'
        : response.status === 403
          ? 'No tienes permisos para registrar incidencias.'
          : response.status === 422
            ? 'Revisa el título y la descripción de la incidencia.'
            : 'No se pudo confirmar el registro. Revisa el listado antes de reintentar.'

    throw new IncidentsApiError(message, response.status)
  }

  return (await response.json()) as Incident
}

export async function getMyIncident(
  accessToken: string,
  incidentId: number,
  signal: AbortSignal,
): Promise<Incident> {
  const response = await fetch(`/api/v1/incidents/${incidentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    const message =
      response.status === 401
        ? 'La sesión ha vencido. Ingresa nuevamente.'
        : response.status === 404
          ? 'La incidencia no está disponible para tu cuenta.'
          : response.status === 403
            ? 'No tienes permisos para consultar esta incidencia.'
            : 'No se pudo cargar el detalle de la incidencia.'

    throw new IncidentsApiError(message, response.status)
  }

  return (await response.json()) as Incident
}

export async function listIncidentQueue(
  accessToken: string,
  offset: number,
  limit: number,
  signal: AbortSignal,
): Promise<Incident[]> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  })

  const response = await fetch(
    `/api/v1/incidents/queue?${params}`,
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
          ? 'Se requiere el rol de responsable TI para consultar la bandeja.'
          : 'No se pudo cargar la bandeja de incidencias.'

    throw new IncidentsApiError(message, response.status)
  }

  return (await response.json()) as Incident[]
}
export async function getQueueIncident(
  accessToken: string,
  incidentId: number,
  signal: AbortSignal,
): Promise<Incident> {
  const response = await fetch(
    `/api/v1/incidents/queue/${incidentId}`,
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
          ? 'Se requiere el rol de responsable TI para consultar este detalle.'
          : response.status === 404
            ? 'La incidencia no está disponible.'
            : 'No se pudo cargar el detalle de la incidencia.'

    throw new IncidentsApiError(message, response.status)
  }

  return (await response.json()) as Incident
}

export async function assignIncident(
  accessToken: string,
  incidentId: number,
  data: IncidentAssign,
): Promise<Incident> {
  const response = await fetch(
    `/api/v1/incidents/queue/${incidentId}/assignment`,
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

  if (!response.ok) {
    const message =
      response.status === 401
        ? 'La sesión ha vencido. Ingresa nuevamente.'
        : response.status === 403
          ? 'Se requiere el rol de responsable TI para asignar incidencias.'
          : response.status === 404
            ? 'La incidencia no está disponible.'
            : response.status === 409
              ? 'La incidencia ya tiene una asignación o cambió de estado. Actualiza su detalle.'
              : response.status === 422
                ? 'Selecciona una cuenta activa con rol de técnico.'
                : 'No se pudo confirmar la asignación. Actualiza el detalle antes de reintentar.'

    throw new IncidentsApiError(message, response.status)
  }

  return (await response.json()) as Incident
}

export async function listMyAssignments(
  accessToken: string,
  offset: number,
  limit: number,
  signal: AbortSignal,
): Promise<Incident[]> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  })

  const response = await fetch(
    `/api/v1/incidents/assigned?${params}`,
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
          ? 'Se requiere el rol de técnico para consultar asignaciones.'
          : 'No se pudo cargar el listado de asignaciones.'

    throw new IncidentsApiError(message, response.status)
  }

  return (await response.json()) as Incident[]
}

export async function getMyAssignment(
  accessToken: string,
  incidentId: number,
  signal: AbortSignal,
): Promise<Incident> {
  const response = await fetch(
    `/api/v1/incidents/assigned/${incidentId}`,
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
          ? 'Se requiere el rol de técnico para consultar este detalle.'
          : response.status === 404
            ? 'La incidencia no está disponible entre tus asignaciones.'
            : 'No se pudo cargar el detalle de la asignación.'

    throw new IncidentsApiError(message, response.status)
  }

  return (await response.json()) as Incident
}

export async function startIncident(
  accessToken: string,
  incidentId: number,
): Promise<Incident> {
  const response = await fetch(
    `/api/v1/incidents/assigned/${incidentId}/start`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    },
  )

  if (!response.ok) {
    const message =
      response.status === 401
        ? 'La sesión ha vencido. Ingresa nuevamente.'
        : response.status === 403
          ? 'Necesitas el rol de técnico para iniciar la atención.'
          : response.status === 404
            ? 'La incidencia no está disponible para tu cuenta.'
            : response.status === 409
              ? 'La incidencia ya fue iniciada o cambió de estado. Actualiza el detalle.'
              : 'No se pudo confirmar el inicio. Actualiza el detalle antes de reintentar.'

    throw new IncidentsApiError(message, response.status)
  }

  return (await response.json()) as Incident
}

export async function resolveIncident(
  accessToken: string,
  incidentId: number,
  data: IncidentResolve,
): Promise<Incident> {
  const response = await fetch(
    `/api/v1/incidents/assigned/${incidentId}/resolve`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    },
  )

  if (!response.ok) {
    const message =
      response.status === 401
        ? 'La sesión ha vencido. Ingresa nuevamente.'
        : response.status === 403
          ? 'Necesitas el rol de técnico para registrar la solución.'
          : response.status === 404
            ? 'La incidencia no está disponible para tu cuenta.'
            : response.status === 409
              ? 'La incidencia cambió de estado o ya tiene una solución. Actualiza el detalle.'
              : response.status === 422
                ? 'La solución debe tener entre 10 y 10000 caracteres.'
                : 'No se pudo confirmar la resolución. Actualiza el detalle antes de reintentar.'

    throw new IncidentsApiError(message, response.status)
  }

  return (await response.json()) as Incident
}

export async function closeIncident(
  accessToken: string,
  incidentId: number,
): Promise<Incident> {
  const response = await fetch(
    `/api/v1/incidents/${incidentId}/close`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    },
  )

  if (!response.ok) {
    const message =
      response.status === 401
        ? 'La sesión ha vencido. Ingresa nuevamente.'
        : response.status === 403
          ? 'No tienes permisos para confirmar este cierre.'
          : response.status === 404
            ? 'La incidencia no está disponible para tu cuenta.'
            : response.status === 409
              ? 'La incidencia ya fue cerrada o no está pendiente de confirmación. Actualiza el detalle.'
              : 'No se pudo confirmar el cierre. Actualiza el detalle antes de reintentar.'

    throw new IncidentsApiError(message, response.status)
  }

  return (await response.json()) as Incident
}

export async function returnIncident(
  accessToken: string,
  incidentId: number,
  data: IncidentReturn,
): Promise<Incident> {
  const response = await fetch(
    `/api/v1/incidents/${incidentId}/return`,
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

  if (!response.ok) {
    const message =
      response.status === 401
        ? 'La sesión ha vencido. Ingresa nuevamente.'
        : response.status === 403
          ? 'No tienes permisos para devolver esta incidencia.'
          : response.status === 404
            ? 'La incidencia no está disponible para tu cuenta.'
            : response.status === 409
              ? 'La incidencia ya no permite esta devolución. Actualiza el detalle.'
              : response.status === 422
                ? 'Escribe un motivo de entre 10 y 2000 caracteres.'
                : 'No se pudo confirmar la devolución. Actualiza el detalle antes de reintentar.'

    throw new IncidentsApiError(message, response.status)
  }

  return (await response.json()) as Incident
}

export async function classifyIncident(
  accessToken: string,
  incidentId: number,
  data: IncidentClassificationUpdate,
): Promise<Incident> {
  const response = await fetch(
    `/api/v1/incidents/queue/${incidentId}/classification`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        category: data.category,
        impact: data.impact,
        urgency: data.urgency,
      }),
      signal: AbortSignal.timeout(15_000),
    },
  )

  if (!response.ok) {
    let message =
      response.status === 401
        ? 'La sesión ha vencido. Ingresa nuevamente.'
        : response.status === 403
          ? 'Solo el responsable TI puede clasificar incidencias.'
          : response.status === 404
            ? 'La incidencia no está disponible.'
            : response.status === 409
              ? 'La incidencia ya no permite modificar su clasificación. Actualiza el detalle.'
              : response.status === 422
                ? 'Selecciona una categoría, un impacto y una urgencia válidos.'
                : 'No se pudo confirmar el guardado. Actualiza el detalle antes de reintentar.'

    if (response.status === 409) {
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
        // Conserva el mensaje si la respuesta no contiene JSON válido.
      }
    }

    throw new IncidentsApiError(message, response.status)
  }

  return (await response.json()) as Incident
}