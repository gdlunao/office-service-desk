export type KnowledgeArticleStatus =
  | 'draft'
  | 'published'
  | 'archived'

export interface KnowledgeArticleSummary {
  id: number
  source_incident_id: number
  title: string
  status: KnowledgeArticleStatus
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface KnowledgeArticle
  extends KnowledgeArticleSummary {
  source_attempt_id: number
  problem_summary: string
  solution_description: string
  technical_actions: string
  recovery_evidence: string
  created_by_id: number
  published_by_id: number | null
}

export const KNOWLEDGE_STATUS_LABELS: Record<
  KnowledgeArticleStatus,
  string
> = {
  draft: 'Borrador',
  published: 'Publicado',
  archived: 'Archivado',
}

export interface KnowledgeArticleCreate {
  source_incident_id: number
}

export interface KnowledgeArticleDraftUpdate {
  title: string
  problem_summary: string
  solution_description: string
  technical_actions: string
  recovery_evidence: string
}