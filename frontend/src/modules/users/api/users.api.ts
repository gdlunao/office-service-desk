import type { User, UserCreate } from '../types/user.types'
import type { UserRole } from '../types/user-role.types'

export class UsersApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'UsersApiError'
    this.status = status
  }
}

export async function listUsers(
  accessToken: string,
  offset: number,
  limit: number,
  signal: AbortSignal,
): Promise<User[]> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  })

  const response = await fetch(`/api/v1/users?${params}`, {
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
          ? 'No tienes permisos para consultar usuarios.'
          : 'No se pudo cargar el listado de usuarios.'

    throw new UsersApiError(message, response.status)
  }

  return (await response.json()) as User[]
}

export async function createUser(
  accessToken: string,
  data: UserCreate,
): Promise<User> {
  const response = await fetch('/api/v1/users', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    let message: string

    switch (response.status) {
      case 401:
        message = 'La sesión ha vencido. Ingresa nuevamente.'
        break
      case 403:
        message = 'No tienes permisos para crear usuarios.'
        break
      case 409:
        message = 'Ya existe un usuario con ese correo.'
        break
      case 422:
        message =
          'Revisa el nombre, el correo y la contraseña de 15 a 128 caracteres.'
        break
      default:
        message =
          'No se pudo confirmar la creación. Actualiza el listado antes de reintentar.'
    }

    throw new UsersApiError(message, response.status)
  }

  return (await response.json()) as User
}

export async function updateUserRole(
  accessToken: string,
  userId: number,
  role: UserRole,
): Promise<User> {
  const response = await fetch(`/api/v1/users/${userId}/role`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    const message =
      response.status === 401
        ? 'La sesión ha vencido. Ingresa nuevamente.'
        : response.status === 403
          ? 'Se requieren permisos de administrador para cambiar roles.'
          : response.status === 404
            ? 'El usuario no existe.'
            : response.status === 422
              ? 'Selecciona un rol válido.'
              : 'No se pudo confirmar el cambio de rol. Actualiza el listado antes de reintentar.'

    throw new UsersApiError(message, response.status)
  }

  return (await response.json()) as User
}