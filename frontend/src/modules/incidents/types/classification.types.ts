export type IncidentCategory =
  | 'C1'
  | 'C2'
  | 'C3'
  | 'C4'
  | 'C5'
  | 'C6'
  | 'C7'
  | 'C8'

export type IncidentImpact = 'high' | 'medium' | 'low'

export type IncidentUrgency = 'high' | 'medium' | 'low'

export type IncidentPriority = 'p1' | 'p2' | 'p3' | 'p4'

export interface IncidentClassificationUpdate {
  category: IncidentCategory
  impact: IncidentImpact
  urgency: IncidentUrgency
}

export const INCIDENT_CATEGORY_LABELS: Record<
  IncidentCategory,
  string
> = {
  C1: 'Conectividad e internet',
  C2: 'Plataformas externas',
  C3: 'Sistemas internos y gestión documental',
  C4: 'Firma digital y certificados',
  C5: 'Impresoras y escáneres',
  C6: 'Equipos de cómputo',
  C7: 'Correo y ofimática',
  C8: 'Accesos y credenciales',
}

export const INCIDENT_IMPACT_LABELS: Record<
  IncidentImpact,
  string
> = {
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
}

export const INCIDENT_URGENCY_LABELS: Record<
  IncidentUrgency,
  string
> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
}

export const INCIDENT_PRIORITY_LABELS: Record<
  IncidentPriority,
  string
> = {
  p1: 'P1',
  p2: 'P2',
  p3: 'P3',
  p4: 'P4',
}