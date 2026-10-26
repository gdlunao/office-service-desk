export interface ResolutionTimeIndicator {
  evaluated_incidents: number
  excluded_incidents: number
  average_minutes: number | null
}

export interface PercentageIndicator {
  evaluated_incidents: number
  excluded_incidents: number
  matching_incidents: number
  percentage: number | null
}

export interface IncidentIndicators {
  data_scope: 'operational'
  period_start: string | null
  period_end: string | null
  resolved_incidents: number
  resolution_time: ResolutionTimeIndicator
  first_solution_recovery: PercentageIndicator
  complete_documentation: PercentageIndicator
}

export interface IncidentIndicatorFilters {
  period_start: string
  period_end: string
}