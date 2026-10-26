import type { UserRole } from '../../users/types/user-role.types'

export interface LoginCredentials {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: 'bearer'
}

export interface CurrentUser {
  id: number
  full_name: string
  email: string
  is_active: boolean
  is_admin: boolean
  role: UserRole
}