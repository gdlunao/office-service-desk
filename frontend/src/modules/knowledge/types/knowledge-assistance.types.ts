import type {
  KnowledgeRecommendationItem,
} from './recommendation.types'

export interface IncidentKnowledgeAssistance {
  explanation: string
  suggested_checks: string[]
  source_article_ids: number[]
  incident_id: number
  sources: KnowledgeRecommendationItem[]
  provider: 'gemini'
  model: string
  requires_review: true
}