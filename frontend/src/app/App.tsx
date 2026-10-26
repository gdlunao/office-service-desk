import { useCallback, useState } from 'react'

import { LoginPage } from '../modules/auth/pages/LoginPage'
import type { CurrentUser } from '../modules/auth/types/auth.types'
import { IncidentQueuePage } from '../modules/incidents/pages/IncidentQueuePage'
import { IncidentsPage } from '../modules/incidents/pages/IncidentsPage'
import { MyAssignmentsPage } from '../modules/incidents/pages/MyAssignmentsPage'
import { KnowledgePage } from '../modules/knowledge/pages/KnowledgePage'
import { NotificationsPage } from '../modules/notifications/pages/NotificationsPage'
import { IncidentIndicatorsPage } from '../modules/reports/pages/IncidentIndicatorsPage'
import { UsersPage } from '../modules/users/pages/UsersPage'
import { AppLayout } from './AppLayout'
import type { AppSection } from './AppLayout'
import { ToastProvider } from '../shared/feedback/ToastProvider'
interface AuthSession {
  accessToken: string
  user: CurrentUser
}

export default function App() {
  const [session, setSession] =
    useState<AuthSession | null>(null)
  const [section, setSection] =
    useState<AppSection>('home')

  function handleLoginSuccess(
    accessToken: string,
    user: CurrentUser,
  ) {
    setSection('home')
    setSession({ accessToken, user })
  }

  const handleLogout = useCallback(() => {
    setSession(null)
    setSection('home')
  }, [])

  if (!session) {
    return (
      <LoginPage onLoginSuccess={handleLoginSuccess} />
    )
  }

  const canViewUsers = session.user.is_admin
  const canViewQueue = session.user.role === 'it_manager'
  const canViewAssignments =
    session.user.role === 'technician'
  const canViewIndicators =
    session.user.role === 'it_manager'
  const canViewKnowledge =
    session.user.role === 'technician' ||
    session.user.role === 'it_manager'

  let activeSection: AppSection = section

  if (
    (section === 'users' && !canViewUsers) ||
    (section === 'incident_queue' && !canViewQueue) ||
    (section === 'my_assignments' && !canViewAssignments) ||
    (section === 'incident_indicators' && !canViewIndicators) ||
    (section === 'knowledge' && !canViewKnowledge)
  ) {
    activeSection = 'home'
  }

  return (
    <ToastProvider>
    <AppLayout
      user={session.user}
      section={activeSection}
      onSectionChange={setSection}
      onLogout={handleLogout}
    >
      {activeSection === 'knowledge' ? (
        <KnowledgePage
          accessToken={session.accessToken}
          canPublish={session.user.role === 'it_manager'}
          onSessionExpired={handleLogout}
        />
      ) : activeSection === 'notifications' ? (
        <NotificationsPage
          accessToken={session.accessToken}
          onSessionExpired={handleLogout}
        />
      ) : activeSection === 'users' ? (
        <UsersPage
          accessToken={session.accessToken}
          onSessionExpired={handleLogout}
        />
      ) : activeSection === 'incidents' ? (
        <IncidentsPage
          accessToken={session.accessToken}
          onSessionExpired={handleLogout}
        />
      ) : activeSection === 'incident_queue' ? (
        <IncidentQueuePage
          accessToken={session.accessToken}
          onSessionExpired={handleLogout}
        />
      ) : activeSection === 'my_assignments' ? (
        <MyAssignmentsPage
          accessToken={session.accessToken}
          onSessionExpired={handleLogout}
        />
      ) : activeSection === 'incident_indicators' ? (
        <IncidentIndicatorsPage
          accessToken={session.accessToken}
          onSessionExpired={handleLogout}
        />
      ) : (
        <section className="content-card">
          <span className="brand-label">
            ATENCIÓN DE INCIDENCIAS TI
          </span>

          <h1>Inicio</h1>

          <p className="page-description">
            Bienvenido, {session.user.full_name}.
          </p>

          <p>
            Desde esta plataforma podrás acceder a las funciones
            habilitadas para tu cuenta.
          </p>
        </section>
      )}
    </AppLayout>
    </ToastProvider>
  )
}