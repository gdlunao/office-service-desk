import { useState } from 'react'
import type { FormEvent } from 'react'

import { createUser, UsersApiError } from '../api/users.api'
import type { User } from '../types/user.types'

interface CreateUserFormProps {
  accessToken: string
  onUserCreated: (user: User) => void
  onSessionExpired: () => void
}

export function CreateUserForm({
  accessToken,
  onUserCreated,
  onSessionExpired,
}: CreateUserFormProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) return

    setErrorMessage('')
    setSuccessMessage('')

    const cleanName = fullName.trim()

    if (cleanName.length < 2) {
      setErrorMessage('El nombre debe tener al menos 2 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.')
      return
    }

    setIsSubmitting(true)

    try {
      const user = await createUser(accessToken, {
        full_name: cleanName,
        email: email.trim(),
        password,
      })

      setFullName('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setSuccessMessage(`La cuenta de ${user.full_name} fue creada.`)
      onUserCreated(user)
    } catch (error: unknown) {
      if (error instanceof UsersApiError) {
        if (error.status === 401) {
          onSessionExpired()
          return
        }

        setErrorMessage(error.message)
      } else if (
        error instanceof TypeError ||
        (error instanceof DOMException &&
          error.name === 'TimeoutError')
      ) {
        setErrorMessage(
          'No se pudo confirmar la creación. Actualiza el listado ' +
            'para comprobar si la cuenta se guardó antes de reintentar.',
        )
      } else {
        setErrorMessage('Ocurrió un error al crear la cuenta.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
      <fieldset disabled={isSubmitting} className="login-fields">
        <legend>Datos de la nueva cuenta</legend>

        <div className="form-field">
          <label htmlFor="new-user-name">Nombre completo</label>
          <input
            id="new-user-name"
            name="full_name"
            type="text"
            autoComplete="off"
            required
            minLength={2}
            maxLength={150}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="new-user-email">Correo electrónico</label>
          <input
            id="new-user-email"
            name="email"
            type="email"
            autoComplete="off"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="new-user-password">Contraseña inicial</label>
          <input
            id="new-user-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={15}
            maxLength={128}
            aria-describedby="new-user-password-help"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <small id="new-user-password-help">
            Utiliza entre 15 y 128 caracteres.
          </small>
        </div>

        <div className="form-field">
          <label htmlFor="new-user-confirm-password">
            Confirmar contraseña
          </label>
          <input
            id="new-user-confirm-password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={15}
            maxLength={128}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>

        {errorMessage && (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        )}

        <button type="submit" className="primary-button">
          {isSubmitting ? 'Creando cuenta…' : 'Crear usuario'}
        </button>
      </fieldset>

      {successMessage && (
        <p role="status">{successMessage}</p>
      )}
    </form>
  )
}