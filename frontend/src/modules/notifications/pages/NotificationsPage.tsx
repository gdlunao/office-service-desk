import { useEffect, useId, useRef, useState } from 'react'

import {
  getUnreadNotificationCount,
  listNotifications,
  markNotificationAsRead,
  NotificationsApiError,
} from '../api/notifications.api'
import type {
  AppNotification,
} from '../types/notification.types'

import './NotificationsPage.css'

interface NotificationsPageProps {
  accessToken: string
  onSessionExpired: () => void
}

const PAGE_SIZE = 20

function formatDate(value: string): string {
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    ? value
    : `${value}Z`

  const date = new Date(normalized)

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible'
  }

  return date.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function getErrorMessage(error: unknown): string {
  if (error instanceof NotificationsApiError) {
    return error.message
  }

  if (
    error instanceof DOMException &&
    error.name === 'TimeoutError'
  ) {
    return 'El servidor tardó demasiado. Actualiza para comprobar el estado de los avisos.'
  }

  return 'No se pudo completar la operación. Comprueba la conexión.'
}

export function NotificationsPage({
  accessToken,
  onSessionExpired,
}: NotificationsPageProps) {
  const filterId = useId()

  const [notifications, setNotifications] =
    useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] =
    useState<number | null>(null)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [offset, setOffset] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [markingId, setMarkingId] =
    useState<number | null>(null)

  const actionController =
    useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true

    async function loadNotifications() {
      setIsLoading(true)
      setErrorMessage('')
      setNotifications([])
      setUnreadCount(null)

      const signal = AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(15_000),
      ])

      try {
        const [items, count] = await Promise.all([
          listNotifications(
            accessToken,
            offset,
            PAGE_SIZE,
            unreadOnly,
            signal,
          ),
          getUnreadNotificationCount(
            accessToken,
            signal,
          ),
        ])

        if (!isActive) return

        setNotifications(items)
        setUnreadCount(count.unread_count)
      } catch (error: unknown) {
        if (!isActive) return

        if (
          error instanceof NotificationsApiError &&
          error.status === 401
        ) {
          onSessionExpired()
          return
        }

        setErrorMessage(getErrorMessage(error))
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadNotifications()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [
    accessToken,
    offset,
    unreadOnly,
    reloadKey,
    onSessionExpired,
  ])

  useEffect(() => {
    setMarkingId(null)

    return () => {
      actionController.current?.abort()
      actionController.current = null
    }
  }, [accessToken])

  const isBusy = isLoading || markingId !== null

  function clearMessages() {
    setActionError('')
    setSuccessMessage('')
  }

  function handleRefresh() {
    clearMessages()
    setReloadKey((value) => value + 1)
  }

  async function handleMarkAsRead(
    notification: AppNotification,
  ) {
    if (
      actionController.current !== null ||
      isLoading ||
      notification.read_at !== null
    ) {
      return
    }

    const controller = new AbortController()
    actionController.current = controller

    setMarkingId(notification.id)
    clearMessages()

    try {
      await markNotificationAsRead(
        accessToken,
        notification.id,
        AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15_000),
        ]),
      )

      if (
        controller.signal.aborted ||
        actionController.current !== controller
      ) {
        return
      }

      setSuccessMessage(
        'La notificación se marcó como leída.',
      )

      if (
        unreadOnly &&
        notifications.length === 1 &&
        offset > 0
      ) {
        setOffset((value) =>
          Math.max(0, value - PAGE_SIZE),
        )
      } else {
        setReloadKey((value) => value + 1)
      }
    } catch (error: unknown) {
      if (
        controller.signal.aborted ||
        actionController.current !== controller
      ) {
        return
      }

      if (
        error instanceof NotificationsApiError &&
        error.status === 401
      ) {
        onSessionExpired()
        return
      }

      setActionError(getErrorMessage(error))
    } finally {
      if (actionController.current === controller) {
        actionController.current = null
        setMarkingId(null)
      }
    }
  }

  return (
    <section className="content-card">
      <div className="section-heading">
        <div>
          <h1>Notificaciones</h1>

          <p className="page-description">
            Consulta los avisos de tus incidencias y
            asignaciones.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={isBusy}
          onClick={handleRefresh}
        >
          Actualizar
        </button>
      </div>

      <div className="notifications-toolbar">
        <p>
          Sin leer:{' '}
          <strong>
            {unreadCount === null ? '—' : unreadCount}
          </strong>
        </p>

        <label
          className="notifications-filter"
          htmlFor={filterId}
        >
          <input
            id={filterId}
            type="checkbox"
            checked={unreadOnly}
            disabled={isBusy}
            onChange={(event) => {
              clearMessages()
              setOffset(0)
              setUnreadOnly(event.target.checked)
            }}
          />

          Mostrar solo no leídas
        </label>
      </div>

      {successMessage && (
        <p role="status">{successMessage}</p>
      )}

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      <div aria-busy={isLoading}>
        {isLoading ? (
          <p role="status">
            Cargando notificaciones…
          </p>
        ) : errorMessage ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : notifications.length === 0 ? (
          <p>
            {offset > 0
              ? 'No hay notificaciones en esta página.'
              : unreadOnly
                ? 'No tienes notificaciones sin leer.'
                : 'Todavía no tienes notificaciones.'}
          </p>
        ) : (
          <ul className="notifications-list">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className={
                  notification.read_at === null
                    ? 'notification-card notification-card-unread'
                    : 'notification-card'
                }
              >
                <div className="notification-card-heading">
                  <h2>{notification.title}</h2>

                  <span className="notification-status">
                    {notification.read_at === null
                      ? 'Sin leer'
                      : 'Leída'}
                  </span>
                </div>

                <p className="notification-message">
                  {notification.message}
                </p>

                <div className="notification-metadata">
                  <span>
                    Incidencia #{notification.incident_id}
                  </span>

                  <span>
                    Recibida:{' '}
                    {formatDate(notification.created_at)}
                  </span>

                  {notification.read_at !== null && (
                    <span>
                      Leída:{' '}
                      {formatDate(notification.read_at)}
                    </span>
                  )}
                </div>

                {notification.read_at === null && (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={isBusy}
                    aria-label={
                      `Marcar como leída: ${notification.title}, incidencia ${notification.incident_id}`
                    }
                    onClick={() =>
                      void handleMarkAsRead(notification)
                    }
                  >
                    {markingId === notification.id
                      ? 'Marcando…'
                      : 'Marcar como leída'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="pagination">
        <button
          type="button"
          className="secondary-button"
          disabled={isBusy || offset === 0}
          onClick={() => {
            clearMessages()
            setOffset((value) =>
              Math.max(0, value - PAGE_SIZE),
            )
          }}
        >
          Anterior
        </button>

        <span>Página {offset / PAGE_SIZE + 1}</span>

        <button
          type="button"
          className="secondary-button"
          disabled={
            isBusy ||
            Boolean(errorMessage) ||
            notifications.length < PAGE_SIZE
          }
          onClick={() => {
            clearMessages()
            setOffset((value) => value + PAGE_SIZE)
          }}
        >
          Siguiente
        </button>
      </div>
    </section>
  )
}