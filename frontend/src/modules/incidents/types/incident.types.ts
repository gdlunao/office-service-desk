import type {
  IncidentCategory,
  IncidentImpact,
  IncidentPriority,
  IncidentUrgency,
} from './classification.types'
export type IncidentStatus =
  | 'reported'
  | 'assigned'
  | 'in_progress'
  | 'pending_confirmation'
  | 'closed'


export interface Incident {
  id: number
  title: string
  description: string
  reporter_id: number
  status: IncidentStatus
  created_at: string
  assigned_to_id: number | null
  assigned_by_id: number | null
  assigned_at: string | null
  started_at: string | null
  resolution_summary: string | null
  resolved_at: string | null
  closed_at: string | null
  reporter_name: string
  assigned_to_name: string | null
  assigned_by_name: string | null
  category: IncidentCategory | null
  impact: IncidentImpact | null
  urgency: IncidentUrgency | null
  priority: IncidentPriority | null
  classified_by_id: number | null
  classified_at: string | null
}

export interface IncidentResolve {
  resolution_summary: string
}

export interface IncidentCreate {
  title: string
  description: string
}

export interface IncidentAssign {
  assigned_to_id: number
}

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  reported: 'Reportada',
  assigned: 'Asignada',
  in_progress: 'En atención',
  pending_confirmation: 'Resuelta, pendiente de confirmación',
  closed: 'Cerrada',
}

export interface IncidentReturn {
  reason: string
}