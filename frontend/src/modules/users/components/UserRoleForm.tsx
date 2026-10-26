import { useState } from 'react'
import type { FormEvent } from 'react'

import { updateUserRole, UsersApiError } from '../api/users.api'
import { USER_ROLE_LABELS } from '../types/user-role.types'
import type { UserRole } from '../types/user-role.types'
import type { User } from '../types/user.types'

interface UserRoleFormProps {
  accessToken: string
  user: User
  onUserUpdated: (user: User) => void
  onSessionExpired: () => void
}

export function UserRoleForm({
  accessToken,
  user,
  onUserUpdated,
  onSessionExpired,
}: UserRoleFormProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(user.role)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting || selectedRole === user.role) return

    setErrorMessage('')
    setSuccessMessage('')
    setIsSubmitting(true)

    try {
      const updatedUser = await updateUserRole(
        accessToken,
        user.id,
        selectedRole,
      )

      setSelectedRole(updatedUser.role)
      setSuccessMessage('Rol guardado correctamente.')
      onUserUpdated(updatedUser)
    } catch (error: unknown) {
      if (
        error instanceof UsersApiError &&
        error.status === 401
      ) {
        onSessionExpired()
        return
      }

      setErrorMessage(
        error instanceof DOMException &&
        error.name === 'TimeoutError'
          ? 'La solicitud tardó demasiado. Actualiza el listado para comprobar si el cambio se guardó.'
          : error instanceof TypeError
            ? 'No se pudo confirmar el cambio por un problema de conexión. Actualiza el listado antes de reintentar.'
            : error instanceof Error
              ? error.message
              : 'No se pudo confirmar el cambio de rol.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      className="user-role-form"
      onSubmit={handleSubmit}
      aria-busy={isSubmitting}
    >
      <label htmlFor={`user-role-${user.id}`}>
        Rol de {user.full_name}
      </label>

      <div className="user-role-actions">
        <select
          id={`user-role-${user.id}`}
          value={selectedRole}
          disabled={isSubmitting}
          onChange={(event) => {
            setSelectedRole(event.target.value as UserRole)
            setErrorMessage('')
            setSuccessMessage('')
          }}
        >
          <option value="collaborator">
            {USER_ROLE_LABELS.collaborator}
          </option>
          <option value="technician">
            {USER_ROLE_LABELS.technician}
          </option>
          <option value="it_manager">
            {USER_ROLE_LABELS.it_manager}
          </option>
        </select>

        <button
          type="submit"
          className="secondary-button"
          disabled={isSubmitting || selectedRole === user.role}
        >
          {isSubmitting ? 'Guardando…' : 'Guardar rol'}
        </button>
      </div>

      {errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p role="status">{successMessage}</p>
      )}
    </form>
  )
}