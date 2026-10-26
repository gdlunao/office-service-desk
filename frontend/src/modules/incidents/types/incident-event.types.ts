import type { IncidentStatus } from './incident.types'

export type IncidentEventType =
  | 'reported'
  | 'assigned'
  | 'started'
  | 'resolved'
  | 'closed'
  | 'returned'
  | 'classified'

export interface IncidentEvent {
  id: number
  incident_id: number
  actor_id: number
  actor_name: string
  event_type: IncidentEventType
  previous_status: IncidentStatus | null
  new_status: IncidentStatus
  details: string | null
  created_at: string
}

export const INCIDENT_EVENT_LABELS: Record<
  IncidentEventType,
  string
> = {
  reported: 'Incidencia registrada',
  assigned: 'Técnico asignado',
  started: 'Atención iniciada',
  resolved: 'Resolución registrada',
  closed: 'Cierre confirmado',
  returned: 'Incidencia devuelta a atención',
  classified: 'Clasificación registrada',
}