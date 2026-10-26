import type { UserRole } from './user-role.types'

export interface User {
  id: number
  full_name: string
  email: string
  is_active: boolean
  created_at: string
  role: UserRole
}

export interface UserCreate {
  full_name: string
  email: string
  password: string
}