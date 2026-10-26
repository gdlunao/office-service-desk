import type { TechnicianOption } from '../types/technician.types'
import { UsersApiError } from './users.api'

export async function listActiveTechnicians(
  accessToken: string,
  offset: number,
  limit: number,
  signal: AbortSignal,
): Promise<TechnicianOption[]> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  })

  const response = await fetch(
    `/api/v1/users/technicians?${params}`,
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
          ? 'Se requiere el rol de responsable TI para consultar técnicos.'
          : 'No se pudo cargar el listado de técnicos.'

    throw new UsersApiError(message, response.status)
  }

  return (await response.json()) as TechnicianOption[]
}