import type { ReactNode } from 'react'

import type { CurrentUser } from '../modules/auth/types/auth.types'
import { USER_ROLE_LABELS } from '../modules/users/types/user-role.types'

export type AppSection =
  | 'home'
  | 'users'
  | 'incidents'
  | 'incident_queue'
  | 'my_assignments'
  | 'incident_indicators'
  | 'knowledge'
  | 'notifications'

interface AppLayoutProps {
  user: CurrentUser
  section: AppSection
  onSectionChange: (section: AppSection) => void
  onLogout: () => void
  children: ReactNode
}

export function AppLayout({
  user,
  section,
  onSectionChange,
  onLogout,
  children,
}: AppLayoutProps) {
  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <span className="brand-label">
            OFFICE SERVICE DESK
          </span>
          <h2>Service Desk</h2>
        </div>

        <nav aria-label="Navegación principal">
          <button
            type="button"
            className="nav-button"
            aria-current={
              section === 'home' ? 'page' : undefined
            }
            onClick={() => onSectionChange('home')}
          >
            Inicio
          </button>

          <button
            type="button"
            className="nav-button"
            aria-current={
              section === 'incidents' ? 'page' : undefined
            }
            onClick={() => onSectionChange('incidents')}
          >
            Mis incidencias
          </button>

          <button
            type="button"
            className="nav-button"
            aria-current={
              section === 'notifications'
                ? 'page'
                : undefined
            }
            onClick={() =>
              onSectionChange('notifications')
            }
          >
            Notificaciones
          </button>

          {user.role === 'technician' && (
            <button
              type="button"
              className="nav-button"
              aria-current={
                section === 'my_assignments'
                  ? 'page'
                  : undefined
              }
              onClick={() =>
                onSectionChange('my_assignments')
              }
            >
              Mis asignaciones
            </button>
          )}

          {user.role === 'it_manager' && (
            <>
              <button
                type="button"
                className="nav-button"
                aria-current={
                  section === 'incident_queue'
                    ? 'page'
                    : undefined
                }
                onClick={() =>
                  onSectionChange('incident_queue')
                }
              >
                Bandeja TI
              </button>

              <button
                type="button"
                className="nav-button"
                aria-current={
                  section === 'incident_indicators'
                    ? 'page'
                    : undefined
                }
                onClick={() =>
                  onSectionChange('incident_indicators')
                }
              >
                Indicadores
              </button>
            </>
          )}

          {user.is_admin && (
            <button
              type="button"
              className="nav-button"
              aria-current={
                section === 'users' ? 'page' : undefined
              }
              onClick={() => onSectionChange('users')}
            >
              Usuarios
            </button>
          )}

          {(user.role === 'technician' ||
            user.role === 'it_manager') && (
            <button
              type="button"
              className="nav-button"
              aria-current={
                section === 'knowledge'
                  ? 'page'
                  : undefined
              }
              onClick={() =>
                onSectionChange('knowledge')
              }
            >
              Base de conocimiento
            </button>
          )}
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div className="header-account">
            <strong>{user.full_name}</strong>

            <span>
              {USER_ROLE_LABELS[user.role] ??
                'Rol desconocido'}
              {user.is_admin ? ' · Administrador' : ''}
            </span>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={onLogout}
          >
            Cerrar sesión
          </button>
        </header>

        <main className="app-content">
          {children}
        </main>
      </div>
    </div>
  )
}