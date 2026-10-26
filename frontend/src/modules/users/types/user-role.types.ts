export type UserRole =
  | 'collaborator'
  | 'technician'
  | 'it_manager'

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  collaborator: 'Colaborador',
  technician: 'Técnico',
  it_manager: 'Responsable TI',
}