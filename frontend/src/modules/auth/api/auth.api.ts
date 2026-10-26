import type {
  CurrentUser,
  LoginCredentials,
  TokenResponse,
} from '../types/auth.types'

export async function login(
  credentials: LoginCredentials,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    username: credentials.email.trim(),
    password: credentials.password,
  })

  const response = await fetch('/api/v1/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Correo o contraseña incorrectos.')
    }

    throw new Error('No se pudo iniciar sesión. Inténtalo nuevamente.')
  }

  return (await response.json()) as TokenResponse
}

export async function getCurrentUser(
  accessToken: string,
): Promise<CurrentUser> {
  const response = await fetch('/api/v1/auth/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('La sesión no es válida o ha vencido.')
    }

    throw new Error('No se pudo consultar la cuenta.')
  }

  return (await response.json()) as CurrentUser
}