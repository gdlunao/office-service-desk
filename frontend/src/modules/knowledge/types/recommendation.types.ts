export interface KnowledgeRecommendationItem {
  article_id: number
  title: string
  problem_summary: string
  matched_keywords: string[]
}

export interface IncidentKnowledgeRecommendations {
  incident_id: number
  search_keywords: string[]
  recommendations: KnowledgeRecommendationItem[]
  method: 'keyword_search'
  requires_review: true
}