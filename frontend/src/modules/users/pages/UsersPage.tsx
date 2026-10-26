import { useEffect, useState } from 'react'

import { listUsers, UsersApiError } from '../api/users.api'
import { CreateUserForm } from '../components/CreateUserForm'
import { UserRoleForm } from '../components/UserRoleForm'
import { USER_ROLE_LABELS } from '../types/user-role.types'
import type { User } from '../types/user.types'

interface UsersPageProps {
  accessToken: string
  onSessionExpired: () => void
}

const PAGE_SIZE = 20

export function UsersPage({
  accessToken,
  onSessionExpired,
}: UsersPageProps) {
  const [users, setUsers] = useState<User[]>([])
  const [offset, setOffset] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true
    let timedOut = false

    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 15_000)

    async function loadUsers() {
      setIsLoading(true)
      setErrorMessage('')
      setUsers([])

      try {
        const result = await listUsers(
          accessToken,
          offset,
          PAGE_SIZE,
          controller.signal,
        )

        if (isActive) {
          setUsers(result)
        }
      } catch (error: unknown) {
        if (!isActive) return

        if (
          error instanceof UsersApiError &&
          error.status === 401
        ) {
          onSessionExpired()
          return
        }

        setErrorMessage(
          timedOut
            ? 'El servidor tardó demasiado. Puedes reintentar.'
            : error instanceof TypeError
              ? 'No se pudo conectar con el servidor.'
              : error instanceof Error
                ? error.message
                : 'No se pudo cargar el listado.',
        )
      } finally {
        window.clearTimeout(timeoutId)

        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadUsers()

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [accessToken, offset, reloadKey, onSessionExpired])

  function handleUserCreated() {
    setOffset(0)
    setReloadKey((value) => value + 1)
  }

  function handleUserUpdated(updatedUser: User) {
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === updatedUser.id ? updatedUser : user,
      ),
    )
  }

  return (
    <section className="content-card">
      <div className="section-heading">
        <div>
          <h1>Usuarios</h1>
          <p className="page-description">
            Consulta y crea cuentas, y asigna sus roles de atención.
          </p>
        </div>

        <div className="section-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={isLoading}
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Actualizar
          </button>

          <button
            type="button"
            className="secondary-button"
            aria-expanded={showCreateForm}
            aria-controls="create-user-panel"
            onClick={() => setShowCreateForm(true)}
          >
            Nuevo usuario
          </button>
        </div>
      </div>

      {showCreateForm && (
        <section
          id="create-user-panel"
          className="create-user-panel"
          aria-labelledby="create-user-title"
        >
          <h2 id="create-user-title">Crear usuario</h2>

          <p className="page-description">
            La nueva cuenta estará activa, tendrá el rol Colaborador
            y no tendrá permisos de administrador.
          </p>

          <CreateUserForm
            accessToken={accessToken}
            onUserCreated={handleUserCreated}
            onSessionExpired={onSessionExpired}
          />
        </section>
      )}

      <div aria-busy={isLoading}>
        {isLoading ? (
          <p role="status">Cargando usuarios…</p>
        ) : errorMessage ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : users.length === 0 ? (
          <p>No hay usuarios en esta página.</p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <caption>Cuentas registradas</caption>

              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Nombre</th>
                  <th scope="col">Correo</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Rol actual</th>
                  <th scope="col">Cambiar rol</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.full_name}</td>
                    <td>{user.email}</td>

                    <td>
                      {user.is_active ? 'Activo' : 'Inactivo'}
                    </td>

                    <td>
                      {USER_ROLE_LABELS[user.role] ??
                        'Rol desconocido'}
                    </td>

                    <td>
                      <UserRoleForm
                        key={`${user.id}-${user.role}`}
                        accessToken={accessToken}
                        user={user}
                        onUserUpdated={handleUserUpdated}
                        onSessionExpired={onSessionExpired}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pagination">
        <button
          type="button"
          className="secondary-button"
          disabled={isLoading || offset === 0}
          onClick={() =>
            setOffset((value) => Math.max(0, value - PAGE_SIZE))
          }
        >
          Anterior
        </button>

        <span>Página {offset / PAGE_SIZE + 1}</span>

        <button
          type="button"
          className="secondary-button"
          disabled={
            isLoading ||
            Boolean(errorMessage) ||
            users.length < PAGE_SIZE
          }
          onClick={() => setOffset((value) => value + PAGE_SIZE)}
        >
          Siguiente
        </button>
      </div>
    </section>
  )
}