export type SolutionAttemptStatus =
  | 'in_progress'
  | 'failed'
  | 'recovered'
  | 'returned'

export interface SolutionAttempt {
  id: number
  incident_id: number
  technician_id: number
  technician_name: string
  attempt_number: number
  status: SolutionAttemptStatus
  solution_description: string | null
  technical_actions: string | null
  recovery_evidence: string | null
  started_at: string
  finished_at: string | null
  returned_at: string | null
  return_reason: string | null
}

export const SOLUTION_ATTEMPT_STATUS_LABELS: Record<
  SolutionAttemptStatus,
  string
> = {
  in_progress: 'En curso',
  failed: 'Sin recuperación',
  recovered: 'Recuperación registrada',
  returned: 'Devuelto por el reportante',
}
export interface SolutionAttemptStart {
  solution_description: string
}

export interface SolutionAttemptFinish {
  status: 'failed' | 'recovered'
  solution_description: string
  technical_actions: string
  recovery_evidence: string | null
}