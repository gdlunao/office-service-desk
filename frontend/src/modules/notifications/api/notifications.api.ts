import type {
  AppNotification,
  NotificationUnreadCount,
} from '../types/notification.types'

export class NotificationsApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'NotificationsApiError'
    this.status = status
  }
}

async function readResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  if (!response.ok) {
    const message =
      response.status === 401
        ? 'La sesión ha vencido. Ingresa nuevamente.'
        : response.status === 403
          ? 'No tienes permisos para realizar esta operación.'
          : response.status === 404
            ? 'La notificación no está disponible para tu cuenta.'
            : fallbackMessage

    throw new NotificationsApiError(
      message,
      response.status,
    )
  }

  return (await response.json()) as T
}

export async function listNotifications(
  accessToken: string,
  offset: number,
  limit: number,
  unreadOnly: boolean,
  signal: AbortSignal,
): Promise<AppNotification[]> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
    unread_only: String(unreadOnly),
  })

  const response = await fetch(
    `/api/v1/notifications?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      signal,
    },
  )

  return readResponse<AppNotification[]>(
    response,
    'No se pudieron cargar las notificaciones.',
  )
}

export async function getUnreadNotificationCount(
  accessToken: string,
  signal: AbortSignal,
): Promise<NotificationUnreadCount> {
  const response = await fetch(
    '/api/v1/notifications/unread-count',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      signal,
    },
  )

  return readResponse<NotificationUnreadCount>(
    response,
    'No se pudo consultar el conteo de notificaciones.',
  )
}

export async function markNotificationAsRead(
  accessToken: string,
  notificationId: number,
  signal: AbortSignal,
): Promise<AppNotification> {
  const response = await fetch(
    `/api/v1/notifications/${notificationId}/read`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    },
  )

  return readResponse<AppNotification>(
    response,
    'No se pudo confirmar la lectura. Actualiza las notificaciones para comprobar su estado.',
  )
}